const express = require("express");
const session = require("express-session");
const app = express();
const mysql = require("mysql2");
const path = require("path");
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
// 創建數據庫連接
const db = {
  host: "localhost",

  port: 3306,

  database: "sys",

  user: "MIIA",

  password: "123456",
};

const connection = mysql.createConnection(db);

app.use(
  session({
    secret: "MySecretKey",
    resave: false,
    saveUninitialized: false, // 不要保存新的未初始化的會話
    cookie: { secure: false }, // 對於HTTPS設置為true
  })
);

// 連接到數據庫
connection.connect((err) => {
  if (err) {
    console.error("連接數據庫失敗: " + err.stack);
    return;
  }

  console.log("連接成功，ID: " + connection.threadId);
});

app.post("/login", (req, res) => {
  const { IdentityCardNumber, password } = req.body;
  console.log(IdentityCardNumber, password);
  try {
    const query = "SELECT * FROM patients WHERE IdentityCardNumber = ?";
    connection.query(
      query,
      [IdentityCardNumber],
      async (error, results, fields) => {
        if (error) {
          console.error(error);
          return res.status(500).send("服务器错误。");
        }

        const user = results[0];
        if (!user) {
          return res.send("用户不存在。");
        }
        // 检查用户输入的密码是否与数据库中的密码匹配
        if (password !== user.password) {
          return res.send("密码不正确。");
        }

        // 将用户标记为已经登录
        req.session.isAuthenticated = true;
        req.session.identityCardNumber = user.IdentityCardNumber;
        // 重定向到主画面
        res.redirect("/dashboard");
      }
    );
  } catch (error) {
    console.error(error);
    res.status(500).send("服务器错误。");
  }
});

// 主画面路由
app.get("/dashboard", (req, res) => {
  // 检查用户是否已登录
  if (req.session.isAuthenticated) {
    // 用户已登录，重定向到主画面
    res.render("home");
  } else {
    // 用户未登录，重定向到登录页或其他处理
    res.render("home");
  }
});

// API端點：根據IdentityCardNumber查詢BirthDate

app.get("/getAge", (req, res) => {
  const identityCardNumber = req.session.identityCardNumber;
  if (!identityCardNumber) {
    return res.status(401).send("未授權訪問");
  }

  const query = "SELECT BirthDate FROM patients WHERE IdentityCardNumber = ?";
  connection.query(query, [identityCardNumber], (error, results) => {
    if (error) {
      console.error(error);
      return res.status(500).send("服務器錯誤");
    }

    if (results.length === 0) {
      return res.status(404).send("用戶未找到");
    }

    const birthDate = results[0].BirthDate;
    const age = calculateAge(birthDate); // 假設您有一個函數來計算年齡
    res.json({ age });
  });
});

function calculateAge(birthDate) {
  var now = new Date();
  var birth = new Date(birthDate);
  var age = now.getFullYear() - birth.getFullYear();
  var m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) {
    age--;
  }

  var d = now.getDate() - birth.getDate();
  if (d < 0) {
    m--;
    d += new Date(now.getFullYear(), now.getMonth(), 0).getDate();
  }

  return age + " 年 " + m + " 個月 " + d + " 天";
}

app.get("/", (req, res) => {
  res.render("login");
});

// 啟動服務器
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`服務器運行在端口${PORT}`);
});
