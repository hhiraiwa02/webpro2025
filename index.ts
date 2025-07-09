import express from "express";
// 生成した Prisma Client をインポート
import { PrismaClient } from "./generated/prisma/client";

const prisma = new PrismaClient({
  // クエリが実行されたときに実際に実行したクエリをログに表示する設定
  log: ["query"],
});

const app = express();

// 環境変数が設定されていれば、そこからポート番号を取得する。環境変数に設定がなければ 8888 を使用する。
const PORT = process.env.PORT || 8888;

// EJS をテンプレートエンジンとして設定するのじゃ。
// これにより、Expressは.ejsファイルをビューとして使うようになるぞ。
app.set("view engine", "ejs");
// ビューファイル（.ejsファイル）がviewsフォルダにあることをExpressに伝えるのじゃ。
app.set("views", "./views");

// form のデータを受け取れるように設定するのじゃ。
// これがないと、HTMLのフォームから送られたデータ（例: ユーザー名）をExpressが受け取れぬぞ。
app.use(express.urlencoded({ extended: true }));

// ルートハンドラーを設定するのじゃ。
// ブラウザから '/' (例: http://localhost:8888/) にアクセスがあったときにこの処理が実行されるぞ。
app.get("/", async (req, res) => {
  // データベースからすべてのユーザーを取得するのじゃ。
  const users = await prisma.user.findMany();
  const papers = await prisma.paper.findMany();
  console.log("ユーザー一覧を取得したぞ:", users);
  // 'index.ejs' というテンプレートファイルをレンダリングし、取得したユーザー情報を渡すのじゃ。
  res.render("index", { users });
  res.render("index", { papers });
});

// ユーザー追加ハンドラーを設定するのじゃ。
// HTMLフォームから '/users' にPOSTリクエストがあったときにこの処理が実行されるぞ。
app.post("/users", async (req, res) => {
  const name = req.body.name; // フォームから送信された 'name' の値を取得するのじゃ。
  if (name) {
    // 名前が入力されていれば、新しいユーザーをデータベースに追加するぞ。
    const newUser = await prisma.user.create({
      data: { name },
    });
    console.log("新しいユーザーを追加したぞ:", newUser);
  }
  // ユーザー追加後、ルートページ（ユーザー一覧ページ）にリダイレクトするのじゃ。
  res.redirect("/");
});

app.post("/papers", async (req, res) => {
  const name = req.body.name; // フォームから送信された 'name' の値を取得するのじゃ。
  const author = req.body.author;
  if (name && author) {
    // 名前が入力されていれば、新しいユーザーをデータベースに追加するぞ。
    const newPaper = await prisma.paper.create({
      data: { name: name, author: author },
    });
  }
  // ユーザー追加後、ルートページ（ユーザー一覧ページ）にリダイレクトするのじゃ。
  res.redirect("/");
});

// サーバーを起動するのじゃ。
// 指定されたポートでリクエストを待ち受けるぞ。
app.listen(PORT, () => {
  console.log(
    `サーバーが起動したぞ！ http://localhost:${PORT} でアクセスできるじゃろう。`
  );
});
