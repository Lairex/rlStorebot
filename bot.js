const {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ChannelType,
  PermissionsBitField,
} = require("discord.js");

const config = require("./config");
const state = require("./state");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

state.client = client;

const TICKET_TYPES = {
  ticket_complaint: {
    label: "تكريه boosting",
    emoji: "↗️",
    channelPrefix: "تكريه",
    message:
      "اكتب الرانك الي انت فيه والرانك الي تريد توصله وراح ندزلك السعر Type What rank are you and what rank you want to get carried",
  },
  ticket_support: {
    label: "مراسلة الدعم",
    emoji: "🎧",
    channelPrefix: "دعم",
    message:
      "اكتب الاشكال الي صايرلك وراح نرد عليك باقرب وقت ممكن say your problem",
  },
  ticket_purchase: {
    label: "شراء",
    emoji: "🛒",
    channelPrefix: "شراء",
    message:
      "اكتب الشي الي تريد تشتريه وحنرد عليك باقرب وقت say what you want to buy",
  },
};

client.on("ready", () => {
  console.log(`✅ البوت اشتغل باسم: ${client.user.tag}`);
  console.log(`🔖 Bot made by Lairex`);
  state.botOnline = true;
  state.botTag = client.user.tag;
});

client.on("guildMemberAdd", async (member) => {
  try {
    const role = member.guild.roles.cache.get(config.MEMBER_ROLE_ID);
    if (role) {
      await member.roles.add(role);
      console.log(`✅ تم إضافة رتبة ميمبر لـ ${member.user.tag}`);
    } else {
      console.log(`❌ ما لقيت رتبة الميمبر - تأكد من الـ ID`);
    }
  } catch (err) {
    console.error("Error adding member role:", err);
  }
});

client.on("messageCreate", async (message) => {
  if (
    message.content === "!setup-ticket" &&
    message.member.permissions.has(PermissionsBitField.Flags.Administrator)
  ) {
    const menu = new StringSelectMenuBuilder()
      .setCustomId("select_ticket_type")
      .setPlaceholder("اختر نوع التذكرة...")
      .addOptions([
        {
          label: "تكريه boosting ",
          value: "ticket_complaint",
          emoji: "↗️",
        },
        {
          label: "مراسلة الدعم support",
          value: "ticket_support",
          emoji: "🎧",
        },
        {
          label: "شراء Buy",
          value: "ticket_purchase",
          emoji: "🛒",
        },
      ]);

    const row = new ActionRowBuilder().addComponents(menu);

    await message.channel.send({
      content:
        "** Welcome! اهلاً وسهلاً!**\nاختر نوع التذكرة من القائمة بالأسفل choose the ticket type below:\n\n-# 🔖 Bot made by Lairex",
      components: [row],
    });

    await message.delete();
  }
});

client.on("interactionCreate", async (interaction) => {
  if (interaction.isStringSelectMenu()) {
    if (interaction.customId === "select_ticket_type") {
      const type = interaction.values[0];
      const ticketInfo = TICKET_TYPES[type];

      await interaction.reply({
        content: "⏳ creating ticket",
        ephemeral: true,
      });

      const ticketChannel = await interaction.guild.channels.create({
        name: `${ticketInfo.channelPrefix}-${interaction.user.username}`,
        type: ChannelType.GuildText,
        parent: config.CATEGORY_ID,
        permissionOverwrites: [
          {
            id: interaction.guild.id,
            deny: [PermissionsBitField.Flags.ViewChannel],
          },
          {
            id: interaction.user.id,
            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.SendMessages,
            ],
          },
          {
            id: config.STAFF_ROLE_ID,
            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.SendMessages,
            ],
          },
        ],
      });

      state.tickets.set(ticketChannel.id, {
        channelId: ticketChannel.id,
        channelName: ticketChannel.name,
        userId: interaction.user.id,
        username: interaction.user.username,
        type: ticketInfo.label,
        emoji: ticketInfo.emoji,
        status: "open",
        createdAt: new Date().toISOString(),
      });

      const closeRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("close_ticket")
          .setLabel("🔒 Close Ticket | إغلاق التذكرة")
          .setStyle(ButtonStyle.Danger),
      );

      await ticketChannel.send({
        content: `${ticketInfo.emoji} <@${interaction.user.id}> | **${ticketInfo.label}**\n\n${ticketInfo.message}\n\n<@&${config.STAFF_ROLE_ID}> سيقوم بالرد عليك قريباً.`,
        components: [closeRow],
      });
    }
  }

  if (interaction.isButton()) {
    if (interaction.customId === "close_ticket") {
      const channel = interaction.channel;

      await channel.permissionOverwrites.set([
        {
          id: interaction.guild.id,
          deny: [PermissionsBitField.Flags.ViewChannel],
        },
        {
          id: config.STAFF_ROLE_ID,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages,
          ],
        },
      ]);

      if (state.tickets.has(channel.id)) {
        const ticket = state.tickets.get(channel.id);
        ticket.status = "closed";
        ticket.closedAt = new Date().toISOString();
        ticket.closedBy = interaction.user.username;
      }

      await interaction.reply(
        "🔒 تم إغلاق التذكرة | Ticket closed. (Staff only)",
      );
    }
  }
});

client.login(config.BOT_TOKEN);

module.exports = { client };
