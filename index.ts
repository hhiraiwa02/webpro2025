// index.ts の全体像 (変更点を適用済み)

import express from "express";
import { PrismaClient } from "./generated/prisma/client";
import session from "express-session";
import dotenv from "dotenv";

dotenv.config();

const prisma = new PrismaClient({
  log: ["query"],
});

const app = express();
const PORT = process.env.PORT || 8888;

app.use(
  session({
    secret: process.env.SESSION_SECRET || "your_secret_key",
    resave: false,
    saveUninitialized: false,
    cookie: { secure: process.env.NODE_ENV === "production" },
  })
);

app.set("view engine", "ejs");
app.set("views", "./views");
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// 認証チェックミドルウェア
const isAuthenticated = (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
  if (req.session && (req.session as any).userId) {
    return next();
  }
  // ログインしていない場合、ログインページにリダイレクト
  res.redirect("/login");
};

// --- ルートハンドラー ---

// 初期ルート: ユーザー登録とログインフォームを表示
app.get("/", (req, res) => {
  res.render("auth", { message: null, error: null });
});

// ログインページを表示
app.get("/login", (req, res) => {
  res.render("auth", { message: null, error: null });
});

// ユーザー登録処理
app.post("/register", async (req, res) => {
  const { name, email, password } = req.body;

  if (!name) {
    return res.render("auth", {
      error: "ユーザー名を入力してください。",
      message: null,
    });
  }

  try {
    const newUser = await prisma.user.create({
      data: {
        name,
        email: email || null, // 空文字列の場合、nullを保存
        password: password || null, // パスワードを平文で保存 (空文字列の場合null)
      },
    });
    console.log("新しいユーザーを登録したぞ:", newUser);
    res.render("auth", {
      message: "登録が完了しました！ログインしてください。",
      error: null,
    });
  } catch (error: any) {
    console.error("ユーザー登録エラー:", error);
    res.render("auth", {
      error: "ユーザー登録に失敗しました。",
      message: null,
    });
  }
});

// ログイン処理 (上記修正済み)
app.post("/login", async (req, res) => {
  const { name, password } = req.body;

  if (!name || !password) {
    return res.render("auth", {
      error: "名前とパスワードを入力してください。",
      message: null,
    });
  }

  try {
    const user = await prisma.user.findFirst({
      where: { name },
    });

    if (!user || user.password === null || user.password !== password) {
      return res.render("auth", {
        error: "ユーザー名またはパスワードが間違っています。",
        message: null,
      });
    }

    (req.session as any).userId = user.id;
    console.log("isAunthenticated : ", isAuthenticated);
    res.redirect("/papers-dashboard"); // セッション保存を待たずにリダイレクト
  } catch (error) {
    console.error("ログインエラー:", error);
    res.render("auth", {
      error: "ログイン中にエラーが発生しました。",
      message: null,
    });
  }
});

// ログアウト処理
app.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("セッション破棄エラー:", err);
      // エラー発生時でも、authページに戻るようにする
      return res.redirect("/");
    }
    res.redirect("/");
  });
});

// 論文の検索・一覧ページ (ログイン必須)
app.get("/papers-dashboard", isAuthenticated, async (req, res) => {
  const searchTitle = req.query.searchTitle as string | undefined;
  const searchAuthor = req.query.searchAuthor as string | undefined;
  const searchCategory = req.query.searchCategory as string | undefined;

  const paperWhereClause: any = {};
  if (searchTitle) {
    paperWhereClause.name = { contains: searchTitle, mode: "insensitive" };
  }
  if (searchAuthor) {
    paperWhereClause.author = { contains: searchAuthor, mode: "insensitive" };
  }
  if (searchCategory) {
    paperWhereClause.category = {
      contains: searchCategory,
      mode: "insensitive",
    };
  }

  const papers = await prisma.paper.findMany({
    where: paperWhereClause,
  });

  res.render("papers-dashboard", {
    papers,
    searchTitle: searchTitle || "",
    searchAuthor: searchAuthor || "",
    searchCategory: searchCategory || "",
  });
});

// 論文追加処理 (ログイン必須)
app.post("/papers", isAuthenticated, async (req, res) => {
  const { name, author, category, url, comment } = req.body;

  if (name && author) {
    const newPaper = await prisma.paper.create({
      data: {
        name,
        author,
        category: category || null,
        url: url || null,
        comment: comment || null,
      },
    });
    console.log("新しい論文を追加したぞ:", newPaper);
  } else {
    console.warn("論文のタイトルと著者は必須です。");
  }
  res.redirect("/papers-dashboard");
});

app.listen(PORT, () => {
  console.log(
    `サーバーが起動したぞ！ http://localhost:${PORT} でアクセスできるじゃろう。`
  );
  console.log(`SESSION_SECRETが設定されていることを確認してください。`);
});
