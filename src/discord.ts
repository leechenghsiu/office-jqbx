// src/discord.ts
import {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type ButtonInteraction,
} from 'discord.js';

export type CommandHandler = (interaction: ChatInputCommandInteraction) => Promise<void>;
export type ButtonHandler = (interaction: ButtonInteraction) => Promise<void>;

const commands = [
  new SlashCommandBuilder().setName('join').setDescription('Join the DJ rotation'),
  new SlashCommandBuilder().setName('leave').setDescription('Leave the DJ rotation'),
  new SlashCommandBuilder()
    .setName('add')
    .setDescription('Search and add a song to your DJ queue')
    .addStringOption(opt => opt.setName('query').setDescription('Song name or artist').setRequired(true)),
  new SlashCommandBuilder()
    .setName('remove')
    .setDescription('Remove a song from your queue')
    .addIntegerOption(opt => opt.setName('index').setDescription('Song number in your queue (starting from 1)').setRequired(true)),
  new SlashCommandBuilder().setName('queue').setDescription('View your DJ queue'),
  new SlashCommandBuilder().setName('now').setDescription('Show the currently playing song'),
  new SlashCommandBuilder().setName('skip').setDescription('Vote to skip the current song'),
  new SlashCommandBuilder().setName('djs').setDescription('Show the DJ rotation'),
];

export async function registerCommands(clientId: string, token: string): Promise<void> {
  const rest = new REST().setToken(token);
  await rest.put(Routes.applicationCommands(clientId), {
    body: commands.map(c => c.toJSON()),
  });
  console.log('Slash commands registered');
}

export function createClient(): Client {
  return new Client({
    intents: [GatewayIntentBits.Guilds],
  });
}
