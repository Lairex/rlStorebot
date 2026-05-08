const express = require("express");
const session = require("express-session");
const axios = require("axios");
const path = require("path");

const config = require("./config");
const state = require("./state");

const app = express();

const REDIRECT_URI =
  process.env.REDIRECT_URI ||
  `https://${process.env.REPLIT_DEV_DOMAIN}/callback`;

app.use(express.json());
app.use(
  session({
    secret: config.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false },
  }),
);
app.use(express.static(path.join(__dirname, "public")));

function requireAuth(req, res, next) {
  if (!req.session.user) return res.redirect("/login");
  next();
}

app.get("/ping", (req, res) => {
  res.status(200).send("OK");
});

app.get("/", requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/login", (req, res) => {
  if (req.session.user) return res.redirect("/");
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

app.get("/auth/discord", (req, res) => {
  const params = new URLSearchParams({
    client_id: config.CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope: "identify",
  });
  res.redirect(`https://discord.com/oauth2/authorize?${params}`);
});

app.get("/callback", async (req, res) => {
  const { code } = req.query;
  if (!code) return res.redirect("/login?error=no_code");

  try {
    const tokenRes = await axios.post(
      "https://discord.com/api/oauth2/token",
      new URLSearchParams({
        client_id: config.CLIENT_ID,
        client_secret: config.CLIENT_SECRET,
        grant_type: "authorization_code",
        code,
        redirect_uri: REDIRECT_URI,
      }),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } },
    );

    const { access_token } = tokenRes.data;

    const userRes = await axios.get("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    const user = userRes.data;

    const memberRes = await axios.get(
      `https://discord.com/api/guilds/${config.GUILD_ID}/members/${user.id}`,
      { headers: { Authorization: `Bot ${config.BOT_TOKEN}` } },
    );

    const member = memberRes.data;
    const hasRole = member.roles.includes(config.STAFF_ROLE_ID);

    if (!hasRole) {
      return res.redirect("/login?error=unauthorized");
    }

    req.session.user = {
      id: user.id,
      username: user.username,
      avatar: user.avatar,
    };

    res.redirect("/");
  } catch (err) {
    console.error("OAuth error:", err.response?.data || err.message);
    res.redirect("/login?error=failed");
  }
});

app.get("/logout", (req, res) => {
  req.session.destroy();
  res.redirect("/login");
});

app.get("/api/status", requireAuth, (req, res) => {
  res.json({
    online: state.botOnline,
    tag: state.botTag,
    totalTickets: state.tickets.size,
    openTickets: Array.from(state.tickets.values()).filter(
      (t) => t.status === "open",
    ).length,
  });
});

app.get("/api/tickets", requireAuth, (req, res) => {
  const tickets = Array.from(state.tickets.values()).sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
  );
  res.json(tickets);
});

app.post("/api/tickets/:channelId/close", requireAuth, async (req, res) => {
  const { channelId } = req.params;
  const ticket = state.tickets.get(channelId);

  if (!ticket) return res.status(404).json({ error: "Ticket not found" });
  if (ticket.status === "closed")
    return res.status(400).json({ error: "Already closed" });

  try {
    const channel = state.client?.channels.cache.get(channelId);
    if (channel) {
      await channel.permissionOverwrites.set([
        {
          id: channel.guild.id,
          deny: [BigInt(0x400)],
        },
        {
          id: config.STAFF_ROLE_ID,
          allow: [BigInt(0x400), BigInt(0x800)],
        },
      ]);
      await channel.send(
        `🔒 تم إغلاق التذكرة من لوحة التحكم بواسطة **${req.session.user.username}** | Ticket closed from dashboard. (Staff only)`,
      );
    }

    ticket.status = "closed";
    ticket.closedAt = new Date().toISOString();
    ticket.closedBy = req.session.user.username;

    res.json({ success: true });
  } catch (err) {
    console.error("Error closing ticket:", err);
    res.status(500).json({ error: "Failed to close ticket" });
  }
});

app.get("/api/me", requireAuth, (req, res) => {
  res.json(req.session.user);
});

app.listen(5000, () => {
  console.log("🌐 Dashboard: http://localhost:5000");
});

module.exports = app;
