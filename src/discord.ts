import {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';

export type CommandHandler = (interaction: ChatInputCommandInteraction) => Promise<void>;

const commands = [
  new SlashCommandBuilder().setName('start-jam').setDescription('Start the Jam — pick a device to play on'),
  new SlashCommandBuilder().setName('stop-jam').setDescription('Stop the Jam'),
  new SlashCommandBuilder()
    .setName('add')
    .setDescription('Search and add a song to the queue')
    .addStringOption(opt => opt.setName('query').setDescription('Song name or artist').setRequired(true)),
  new SlashCommandBuilder().setName('queue').setDescription('View the current queue'),
  new SlashCommandBuilder().setName('now').setDescription('Show the currently playing song'),
  new SlashCommandBuilder().setName('skip').setDescription('Skip the current song'),
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
