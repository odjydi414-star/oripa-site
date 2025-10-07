const express = require("express");
const app = express();
const PORT = 3000;
const stripe = require("stripe")("sk_test_あなたの秘密キー"); // ←ここに自分のキーを入れる

app.use(express.static("public"));
app.use(express.json());

const ADMIN_PASSWORD = "1241";
let currentToken = "";

let cardPool = [
  { name: "ナンジャモSAR", type: "当たり", chance: 1, stock: 3 },
  { name: "RRカード", type: "ハズレ", chance: 99, stock: 999 }
];

let historyLog = [];

app.post("/admin-login", (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    currentToken = "secure-token";
    res.json({ success: true, token: currentToken });
  } else {
    res.json({ success: false });
  }
});

app.get("/cards", (req, res) => {
  res.json(cardPool);
});

app.post("/update-cards", (req, res) => {
  const auth = req.headers.authorization;
  if (auth !== `Bearer ${currentToken}`) return res.status(403).json({ error: "認証失敗" });

  req.body.forEach(({ index, chance, stock }) => {
    if (cardPool[index]) {
      cardPool[index].chance = chance;
      cardPool[index].stock = stock;
    }
  });
  res.json({ success: true });
});

app.post("/add-card", (req, res) => {
  const auth = req.headers.authorization;
  if (auth !== `Bearer ${currentToken}`) return res.status(403).json({ error: "認証失敗" });

  const { name, type, chance, stock } = req.body;
  if (!name || !type || isNaN(chance) || isNaN(stock)) {
    return res.status(400).json({ error: "不正な入力" });
  }

  cardPool.push({ name, type, chance, stock });
  res.json({ success: true });
});

app.post("/delete-card", (req, res) => {
  const auth = req.headers.authorization;
  if (auth !== `Bearer ${currentToken}`) return res.status(403).json({ error: "認証失敗" });

  const { index } = req.body;
  if (index >= 0 && index < cardPool.length) {
    cardPool.splice(index, 1);
    res.json({ success: true });
  } else {
    res.status(400).json({ error: "不正なインデックス" });
  }
});

app.get("/history", (req, res) => {
  res.json(historyLog);
});

// ✅ Stripe決済API
app.post("/create-checkout-session", async (req, res) => {
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    line_items: [{
      price_data: {
        currency: "jpy",
        product_data: {
          name: "オリパ抽選1回"
        },
        unit_amount: 300 * 100 // 300円
      },
      quantity: 1
    }],
    mode: "payment",
    success_url: "http://localhost:3000/success.html",
    cancel_url: "http://localhost:3000/cancel.html"
  });

  res.json({ url: session.url });
});

// ✅ 決済後に抽選を実行
app.get("/paid-draw", (req, res) => {
  const available = cardPool.filter(card => card.stock > 0);
  const total = available.reduce((sum, item) => sum + item.chance, 0);
  const rand = Math.floor(Math.random() * total);

  let cumulative = 0;
  for (let item of available) {
    cumulative += item.chance;
    if (rand < cumulative) {
      item.stock--;
      historyLog.push({
        user: "購入者",
        name: item.name,
        type: item.type,
        time: Date.now()
      });
      return res.json(item);
    }
  }
});

app.listen(PORT, () => {
  console.log(`✅ http://localhost:${PORT} で起動中`);
});