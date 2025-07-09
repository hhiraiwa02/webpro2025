// index.ts
import express from "express";
import { PrismaClient } from "./generated/prisma/client";
import session from "express-session"; // セッション管理のためのパッケージ
import bcrypt from "bcrypt"; // パスワードハッシュ化のためのパッケージ

const prisma = new PrismaClient({
  log: ["query"],
});

const app = express();
const PORT = process.env.PORT || 8888;

app.set("view engine", "ejs");
app.set("views", "./views");
app.use(express.urlencoded({ extended: true }));

// セッションミドルウェアの設定
app.use(
  session({
    secret: "your_secret_key", // 秘密鍵 (本番環境では環境変数で管理すること)
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 24 }, // 24時間セッションを保持
  })
);

// 認証ミドルウェア
const isAuthenticated = (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
  if (req.session && req.session.userId) {
    return next();
  }
  res.redirect("/"); // ログインしていない場合はルートページへリダイレクト
};

// 初期ルート: ログイン・ユーザー登録ページ
app.get("/", async (req, res) => {
  if (req.session && req.session.userId) {
    // ログイン済みの場合は論文管理ページへリダイレクト
    return res.redirect("/papers");
  }
  res.render("auth", { errorMessage: null }); // 認証ページ (auth.ejs を作成します)
});

// ユーザー登録処理
app.post("/register", async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.render("auth", {
      errorMessage: "名前、Email、パスワードは必須です。",
    });
  }

  try {
    // パスワードのハッシュ化
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
      errorMessage: "登録が完了しました。ログインしてください。",
    });
  } catch (error: any) {
    if (error.code === "P2002" && error.meta?.target) {
      if (error.meta.target.includes("name")) {
        return res.render("auth", {
          errorMessage: "このユーザー名は既に使用されています。",
        });
      }
      if (error.meta.target.includes("email")) {
        return res.render("auth", {
          errorMessage: "このEmailアドレスは既に登録されています。",
        });
      }
    }
    console.error("ユーザー登録エラー:", error);
    res.render("auth", { errorMessage: "ユーザー登録に失敗しました。" });
  }
});

// ログイン処理
app.post("/login", async (req, res) => {
  const { name, password } = req.body;

  if (!name || !password) {
    return res.render("auth", {
      errorMessage: "名前とパスワードを入力してください。",
    });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { name },
    });

    if (!user) {
      return res.render("auth", {
        errorMessage: "ユーザー名またはパスワードが間違っています。",
      });
    }

    // パスワードの比較
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.render("auth", {
        errorMessage: "ユーザー名またはパスワードが間違っています。",
      });
    }

    // ログイン成功: セッションにユーザーIDを保存
    req.session.userId = user.id;
    res.redirect("/papers"); // 論文管理ページへリダイレクト
  } catch (error) {
    console.error("ログインエラー:", error);
    res.render("auth", { errorMessage: "ログインに失敗しました。" });
  }
});

// ログアウト処理
app.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("ログアウトエラー:", err);
      return res.redirect("/papers");
    }
    res.clearCookie("connect.sid"); // セッションクッキーを削除
    res.redirect("/");
  });
});

// 論文管理ページ（認証が必要）
app.get("/papers", isAuthenticated, async (req, res) => {
  const userId = req.session.userId;

  // 検索クエリパラメータを取得
  const searchTitle = req.query.searchTitle as string | undefined;
  const searchAuthor = req.query.searchAuthor as string | undefined;
  const searchCategory = req.query.searchCategory as string | undefined;

  // 検索条件を構築
  const paperWhereClause: any = { userId: userId }; // ログインユーザーの論文のみ
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

  // データベースから論文を取得（検索条件とユーザーIDを適用）
  const papers = await prisma.paper.findMany({
    where: paperWhereClause,
  });

  const user = await prisma.user.findUnique({ where: { id: userId } });

  console.log("ログインユーザーの論文一覧を取得したぞ:", papers);

  res.render("index", {
    userName: user?.name, // ログインユーザーの名前を渡す
    papers,
    searchTitle: searchTitle || "",
    searchAuthor: searchAuthor || "",
    searchCategory: searchCategory || "",
  });
});

// 論文追加処理（認証が必要）
app.post("/papers", isAuthenticated, async (req, res) => {
  const { name, author, category, url, comment } = req.body;
  const userId = req.session.userId;

  if (name && author && userId) {
    const newPaper = await prisma.paper.create({
      data: {
        name,
        author,
        category: category || null,
        url: url || null,
        comment: comment || null,
        userId: userId, // ログイン中のユーザーIDを保存
      },
    });
    console.log("新しい論文を追加したぞ:", newPaper);
  } else {
    console.warn("論文のタイトルと著者は必須です。");
  }
  res.redirect("/papers");
});

app.listen(PORT, () => {
  console.log(
    `サーバーが起動したぞ！ http://localhost:${PORT} でアクセスできるじゃろう。`
  );
});

// express-session の型定義を拡張
declare module "express-session" {
  interface SessionData {
    userId: number;
  }
}
