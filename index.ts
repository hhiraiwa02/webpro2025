import express from "express";
import { PrismaClient } from "./generated/prisma/client";

const prisma = new PrismaClient({
  log: ["query"],
});

const app = express();
const PORT = process.env.PORT || 8888;

app.set("view engine", "ejs");
app.set("views", "./views");
app.use(express.urlencoded({ extended: true }));

app.get("/", async (req, res) => {
  // ユーザー一覧はそのまま
  const users = await prisma.user.findMany();

  // 検索クエリパラメータを取得
  const searchTitle = req.query.searchTitle as string | undefined;
  const searchAuthor = req.query.searchAuthor as string | undefined;
  const searchCategory = req.query.searchCategory as string | undefined;

  // 検索条件を構築
  const paperWhereClause: any = {};
  if (searchTitle) {
    paperWhereClause.name = { contains: searchTitle, mode: "insensitive" }; // 部分一致検索 (大文字小文字を区別しない)
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

  // データベースから論文を取得（検索条件を適用）
  const papers = await prisma.paper.findMany({
    where: paperWhereClause,
  });

  console.log("ユーザー一覧を取得したぞ:", users);
  console.log("論文一覧を取得したぞ:", papers);

  // EJSテンプレートにユーザー、論文、現在の検索クエリを渡す
  res.render("index", {
    users,
    papers,
    searchTitle: searchTitle || "", // テンプレートで利用するために現在の検索クエリも渡す
    searchAuthor: searchAuthor || "",
    searchCategory: searchCategory || "",
  });
});

app.post("/users", async (req, res) => {
  const name = req.body.name;
  if (name) {
    const newUser = await prisma.user.create({
      data: { name },
    });
    console.log("新しいユーザーを追加したぞ:", newUser);
  }
  res.redirect("/");
});

app.post("/papers", async (req, res) => {
  const { name, author, category, url, comment } = req.body;

  if (name && author) {
    // タイトルと著者は必須
    const newPaper = await prisma.paper.create({
      data: {
        name,
        author,
        category: category || null, // 任意項目は空文字列の場合nullにする
        url: url || null,
        comment: comment || null,
      },
    });
    console.log("新しい論文を追加したぞ:", newPaper);
  } else {
    console.warn("論文のタイトルと著者は必須です。");
  }
  res.redirect("/");
});

app.listen(PORT, () => {
  console.log(
    `サーバーが起動したぞ！ http://localhost:${PORT} でアクセスできるじゃろう。`
  );
});
