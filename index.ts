// index.ts
import express from "express";
import { PrismaClient } from "./generated/prisma/client";
import session from "express-session";
import bcrypt from "bcrypt";

const prisma = new PrismaClient({
  log: ["query"],
});

const app = express();
const PORT = process.env.PORT || 8888;

app.set("view engine", "ejs");
app.set("views", "./views");
app.use(express.urlencoded({ extended: true }));
app.use(express.json()); // JSONボディをパースするために追加

// セッションミドルウェアの設定
app.use(
  session({
    secret: "your_secret_key",
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 24 },
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
  res.redirect("/");
};

// 初期ルート: ログイン・ユーザー登録ページ
app.get("/", async (req, res) => {
  if (req.session && req.session.userId) {
    return res.redirect("/papers");
  }
  res.render("auth", { errorMessage: null });
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
    const hashedPassword = await bcrypt.hash(password, 10);

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

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.render("auth", {
        errorMessage: "ユーザー名またはパスワードが間違っています。",
      });
    }

    req.session.userId = user.id;
    res.redirect("/papers");
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
    res.clearCookie("connect.sid");
    res.redirect("/");
  });
});

// 論文管理ページ（認証が必要）
app.get("/papers", isAuthenticated, async (req, res) => {
  const userId = req.session.userId;

  const searchTitle = req.query.searchTitle as string | undefined;
  const searchAuthor = req.query.searchAuthor as string | undefined;
  const searchCategory = req.query.searchCategory as string | undefined;
  const searchStatus = req.query.searchStatus as string | undefined; // ステータス検索を追加

  const paperWhereClause: any = { userId: userId };
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
  if (searchStatus && searchStatus !== "全て") {
    // 「全て」でない場合のみフィルタ
    paperWhereClause.status = searchStatus;
  }

  const papers = await prisma.paper.findMany({
    where: paperWhereClause,
    orderBy: {
      updatedAt: "desc",
    },
  });

  const user = await prisma.user.findUnique({ where: { id: userId } });

  console.log("ログインユーザーの論文一覧を取得したぞ:", papers);

  // ステータスオプションを定義
  const statusOptions = ["全て", "未読", "読了", "要再読", "レビュー中"];

  res.render("index", {
    userName: user?.name,
    papers,
    searchTitle: searchTitle || "",
    searchAuthor: searchAuthor || "",
    searchCategory: searchCategory || "",
    searchStatus: searchStatus || "全て", // 選択中のステータスを渡す
    statusOptions, // ステータスオプションを渡す
    editPaper: null,
  });
});

// 論文追加処理（認証が必要）
app.post("/papers", isAuthenticated, async (req, res) => {
  const { name, author, category, url, comment } = req.body;
  const userId = req.session.userId;

  if (name && author && userId) {
    try {
      const newPaper = await prisma.paper.create({
        data: {
          name,
          author,
          category: category || null,
          url: url || null,
          comment: comment || null,
          userId: userId,
          status: "未読", // 新規作成時はデフォルトで「未読」
        },
      });
      console.log("新しい論文を追加したぞ:", newPaper);
    } catch (error) {
      console.error("論文追加エラー:", error);
    }
  } else {
    console.warn("論文のタイトルと著者は必須です。");
  }
  res.redirect("/papers");
});

// 論文編集フォーム表示（認証が必要）
app.get("/papers/edit/:id", isAuthenticated, async (req, res) => {
  const userId = req.session.userId;
  const paperId = parseInt(req.params.id);

  try {
    const paperToEdit = await prisma.paper.findUnique({
      where: { id: paperId },
    });

    if (!paperToEdit || paperToEdit.userId !== userId) {
      return res.redirect("/papers");
    }

    const papers = await prisma.paper.findMany({
      where: { userId: userId },
      orderBy: { updatedAt: "desc" },
    });
    const user = await prisma.user.findUnique({ where: { id: userId } });
    const statusOptions = ["未読", "読了", "要再読", "レビュー中"]; // 編集ページでもオプションを渡す

    res.render("index", {
      userName: user?.name,
      papers,
      searchTitle: "",
      searchAuthor: "",
      searchCategory: "",
      searchStatus: "全て", // 編集画面表示時は検索ステータスをリセット
      statusOptions,
      editPaper: paperToEdit,
    });
  } catch (error) {
    console.error("論文編集フォーム表示エラー:", error);
    res.redirect("/papers");
  }
});

// 論文更新処理（認証が必要）
app.post("/papers/update/:id", isAuthenticated, async (req, res) => {
  const userId = req.session.userId;
  const paperId = parseInt(req.params.id);
  const { name, author, category, url, comment, status } = req.body; // statusも受け取る

  if (!name || !author) {
    console.warn("論文のタイトルと著者は必須です。");
    return res.redirect("/papers");
  }

  try {
    const existingPaper = await prisma.paper.findUnique({
      where: { id: paperId },
    });

    if (!existingPaper || existingPaper.userId !== userId) {
      return res.redirect("/papers");
    }

    const updatedPaper = await prisma.paper.update({
      where: { id: paperId },
      data: {
        name,
        author,
        category: category || null,
        url: url || null,
        comment: comment || null,
        status: status, // ステータスを更新
      },
    });
    console.log("論文を更新したぞ:", updatedPaper);
  } catch (error) {
    console.error("論文更新エラー:", error);
  }
  res.redirect("/papers");
});

// **論文ステータス更新APIエンドポイント**
app.patch("/api/papers/:id/status", isAuthenticated, async (req, res) => {
  const userId = req.session.userId;
  const paperId = parseInt(req.params.id);
  const { status } = req.body; // 新しいステータスを受け取る

  // 有効なステータスかチェック
  const validStatuses = ["未読", "読了", "要再読", "レビュー中"];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ message: "無効なステータス値です。" });
  }

  try {
    const existingPaper = await prisma.paper.findUnique({
      where: { id: paperId },
    });

    if (!existingPaper || existingPaper.userId !== userId) {
      return res.status(403).json({ message: "権限がありません。" });
    }

    const updatedPaper = await prisma.paper.update({
      where: { id: paperId },
      data: {
        status: status,
      },
    });
    res
      .status(200)
      .json({ message: "ステータスが更新されました。", paper: updatedPaper });
  } catch (error) {
    console.error("ステータス更新エラー:", error);
    res.status(500).json({ message: "ステータスの更新に失敗しました。" });
  }
});

// 論文削除処理（認証が必要）
app.post("/papers/delete/:id", isAuthenticated, async (req, res) => {
  const userId = req.session.userId;
  const paperId = parseInt(req.params.id);

  try {
    const existingPaper = await prisma.paper.findUnique({
      where: { id: paperId },
    });

    if (!existingPaper || existingPaper.userId !== userId) {
      return res.redirect("/papers");
    }

    await prisma.paper.delete({
      where: { id: paperId },
    });
    console.log(`論文ID ${paperId} を削除したぞ。`);
  } catch (error) {
    console.error("論文削除エラー:", error);
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
