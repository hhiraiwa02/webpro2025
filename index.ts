import express from "express";
import { PrismaClient } from "./generated/prisma/client";
import session from "express-session"; // セッション管理のためにインポート
import bcrypt from "bcryptjs"; // パスワードハッシュ化のためにインポート
import dotenv from "dotenv"; // 環境変数をロードするためにインポート

dotenv.config(); // .envファイルから環境変数をロード

const prisma = new PrismaClient({
  log: ["query"],
});

const app = express();
const PORT = process.env.PORT || 8888;

// セッションミドルウェアの設定
app.use(
  session({
    secret: process.env.SESSION_SECRET || "your_secret_key", // 環境変数からシークレットキーを取得、なければデフォルト
    resave: false, // セッションストアにセッションを強制的に再保存しない
    saveUninitialized: false, // 初期化されていないセッションを保存しない
    cookie: { secure: process.env.NODE_ENV === "production" }, // HTTPSの場合のみCookieを送信
  })
);

app.set("view engine", "ejs");
app.set("views", "./views");
app.use(express.urlencoded({ extended: true }));
app.use(express.json()); // JSON形式のボディもパースできるように追加

// 認証チェックミドルウェア
const isAuthenticated = (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
  if (req.session && (req.session as any).userId) {
    // anyで一時的に型アサーション
    return next(); // ログイン済みであれば次へ
  }
  res.redirect("/login"); // ログインしていなければログインページへリダイレクト
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

  if (!name || !email || !password) {
    return res.render("auth", {
      error: "全ての項目を入力してください。",
      message: null,
    });
  }

  try {
    // パスワードをハッシュ化
    const hashedPassword = await bcrypt.hash(password, 10); // ソルトラウンド10

    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
      },
    });
    console.log("新しいユーザーを登録したぞ:", newUser);
    res.render("auth", {
      message: "登録が完了しました！ログインしてください。",
      error: null,
    });
  } catch (error: any) {
    if (error.code === "P2002") {
      // ユニーク制約違反の場合
      return res.render("auth", {
        error: "その名前またはメールアドレスは既に使用されています。",
        message: null,
      });
    }
    console.error("ユーザー登録エラー:", error);
    res.render("auth", {
      error: "ユーザー登録に失敗しました。",
      message: null,
    });
  }
});

// ログイン処理
app.post("/login", async (req, res) => {
  const { name, password } = req.body;

  if (!name || !password) {
    return res.render("auth", {
      error: "名前とパスワードを入力してください。",
      message: null,
    });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { name },
    });

    if (!user) {
      return res.render("auth", {
        error: "ユーザー名またはパスワードが間違っています。",
        message: null,
      });
    }

    // パスワードの比較
    const isMatch = await bcrypt.compare(password, user.password);

    if (isMatch) {
      (req.session as any).userId = user.id; // セッションにユーザーIDを保存
      res.redirect("/papers-dashboard"); // ログイン成功後、論文ダッシュボードへリダイレクト
    } else {
      res.render("auth", {
        error: "ユーザー名またはパスワードが間違っています。",
        message: null,
      });
    }
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
      return res.redirect("/papers-dashboard"); // エラーの場合もとりあえずリダイレクト
    }
    res.redirect("/"); // ログアウト後、初期ページへリダイレクト
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
  res.redirect("/papers-dashboard"); // 論文追加後、論文ダッシュボードへリダイレクト
});

// サーバーを起動
app.listen(PORT, () => {
  console.log(
    `サーバーが起動したぞ！ http://localhost:${PORT} でアクセスできるじゃろう。`
  );
  console.log(`SESSION_SECRETが設定されていることを確認してください。`);
});
