import { randomUUID } from "node:crypto";
import { Bot, InlineKeyboard } from "grammy";
import type { TelegramConfig } from "./config.js";
import { PhoenixApiClient, telegramIdempotencyKey } from "./api-client.js";

interface PendingLead {
  confirmationId: string;
  companyName: string;
  expiresAt: number;
}

const HELP = [
  "Phoenix BOS commands:",
  "/status — backend availability",
  "/leads — recent leads",
  "/lead_new <company> — propose a lead, then confirm",
  "/offers — recent commercial offers",
  "/tasks — open tasks",
  "/help — this message",
].join("\n");

function commandFromUpdate(text: string | undefined): string | null {
  if (!text?.startsWith("/")) return null;
  return text.split(/\s/, 1)[0]!.split("@")[0]!.toLowerCase();
}

function listMessage<T>(title: string, values: T[], format: (value: T) => string): string {
  if (!values.length) return `${title}: none`;
  return `${title}:\n${values.slice(0, 10).map(format).join("\n")}`;
}

export function createTelegramBot(config: TelegramConfig, api = new PhoenixApiClient(config.apiUrl, config.apiEmail, config.apiPassword)) {
  const bot = new Bot(config.botToken);
  const pendingLeads = new Map<string, PendingLead>();

  bot.use(async (context, next) => {
    const userId = context.from?.id.toString();
    if (!userId) return;
    const command = commandFromUpdate(context.message?.text)
      ?? (context.callbackQuery?.data?.startsWith("lead_confirm:") ? "/lead_new_confirm" : null)
      ?? (context.callbackQuery?.data?.startsWith("lead_cancel:") ? "/lead_new_cancel" : null);
    if (!command) return next();
    const allowed = config.allowedUserIds.has(userId);
    try {
      await api.recordTelegramCommand(context.update.update_id, userId, command, allowed);
    } catch {
      if (allowed) {
        await context.reply("Phoenix BOS audit service is unavailable. Command was not executed.");
        return;
      }
    }
    if (!allowed) {
      await context.reply("Access denied.");
      return;
    }
    await next();
  });

  bot.command("start", (context) => context.reply("Phoenix BOS control interface is ready.\n\n" + HELP));
  bot.command("help", (context) => context.reply(HELP));
  bot.command("status", async (context) => context.reply(await api.health() ? "Phoenix BOS is available." : "Phoenix BOS is unavailable."));
  bot.command("leads", async (context) => context.reply(listMessage("Recent leads", await api.listLeads(), (lead) => `• ${lead.companyName} — ${lead.status}`)));
  bot.command("offers", async (context) => context.reply(listMessage("Recent offers", await api.listOffers(), (offer) => `• ${offer.id.slice(0, 8)} — ${offer.status} — ${offer.totalMinor} ${offer.currency} minor units`)));
  bot.command("tasks", async (context) => context.reply(listMessage("Open tasks", await api.listTasks(), (task) => `• ${task.type} — ${task.status} — due ${task.dueAt}`)));

  bot.command("lead_new", async (context) => {
    if (!context.from) return;
    const userId = context.from.id.toString();
    const companyName = context.match.trim();
    if (!companyName || companyName.length > 200) {
      await context.reply("Usage: /lead_new <company name> (maximum 200 characters)");
      return;
    }
    const confirmationId = randomUUID();
    pendingLeads.set(userId, { confirmationId, companyName, expiresAt: Date.now() + 5 * 60_000 });
    const keyboard = new InlineKeyboard()
      .text("Confirm create", `lead_confirm:${confirmationId}`)
      .text("Cancel", `lead_cancel:${confirmationId}`);
    await context.reply(`Create lead “${companyName}”? This write requires confirmation.`, { reply_markup: keyboard });
  });

  bot.callbackQuery(/^lead_confirm:(.+)$/, async (context) => {
    const userId = context.from.id.toString();
    const pending = pendingLeads.get(userId);
    const confirmationId = context.match[1];
    if (!pending || pending.confirmationId !== confirmationId || pending.expiresAt < Date.now()) {
      pendingLeads.delete(userId);
      await context.answerCallbackQuery({ text: "Confirmation expired" });
      return;
    }
    pendingLeads.delete(userId);
    const lead = await api.createLead(pending.companyName, telegramIdempotencyKey(context.update.update_id));
    await context.answerCallbackQuery({ text: "Lead created" });
    await context.editMessageText(`Lead created: ${lead.companyName} — ${lead.status}`);
  });

  bot.callbackQuery(/^lead_cancel:(.+)$/, async (context) => {
    pendingLeads.delete(context.from.id.toString());
    await context.answerCallbackQuery({ text: "Cancelled" });
    await context.editMessageText("Lead creation cancelled.");
  });

  bot.on("message:text", async (context) => {
    if (context.message.text.startsWith("/")) await context.reply("Unknown command. Use /help.");
  });

  bot.catch(() => console.error("Telegram update failed"));
  return bot;
}
