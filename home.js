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
app.use("/static", express.static(path.join(__dirname, "node_modules")));

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
    saveUninitialized: false, 
    cookie: { secure: false }, 
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
  /*console.log(IdentityCardNumber, password);*/
  try {
    const query = "SELECT * FROM patients WHERE IdentityCardNumber = ?";
    connection.query(
      query,
      [IdentityCardNumber],
      async (error, results, fields) => {
        if (error) {
          console.error(error);
          return res.status(500).send("伺服器錯誤。");
        }

        const user = results[0];
        if (!user) {
          return res.send("使用者不存在。");
        }
        // 
        if (password !== user.password) {
          return res.send("密碼錯誤。");
        }

        // 已登錄標籤
        req.session.isAuthenticated = true;
        req.session.identityCardNumber = user.IdentityCardNumber;
        //重回主畫面
        res.redirect("/dashboard");
      }
    );
  } catch (error) {
    console.error(error);
    res.status(500).send("服务器错误。");
  }
});


/*app.get("/dashboard", (req, res) => {
  if (req.session.isAuthenticated) {
    res.render("home");
  } else {
    res.render("home");
  }
});*/

/*app.get("/dashboard", (req, res) => {
  if (req.session.isAuthenticated) {
    const identityCardNumber = req.session.identityCardNumber;
    if (!identityCardNumber) {
      return res.status(400).send("Identity Card Number is required");
    }

    connection.query(
      "SELECT BirthDate FROM patients WHERE IdentityCardNumber = ?",
      [identityCardNumber],
      (err, result) => {
        if (err) {
          return res.status(500).send("Database Error");
        }

        if (result.length === 0) {
          return res.status(404).send("Patient not found");
        }

        const birthDate = new Date(result[0].BirthDate);
        const age = calculateage(birthDate);

        connection.query("SELECT * FROM Vaccine", (err, vaccines) => {
          if (err) {
            return res.status(500).send("Database Error");
          }

          const categories = {
            past: [],
            withinYear: [],
            future: [],
          };

          vaccines.forEach((vaccine) => {
            const { startMonths, endMonths } = parseVaccinationTime(
              vaccine.VaccinationTime
            );
            const startAgeInYears = startMonths / 12;
            const endAgeInYears = endMonths / 12;

            if (age > endAgeInYears) {
              categories.past.push(vaccine); // 已經過了施打疫苗期間
            } else if (age + 1 < startAgeInYears) {
              categories.future.push(vaccine); // 未來超過一年的
            } else {
              categories.withinYear.push(vaccine); // 未來一年內要施打
            }
          });

          res.render("home", { categories });
        });
      }
    );
  } else {
    res.redirect("/login");
  }
});*/

app.get("/dashboard", (req, res) => {
  if (req.session.isAuthenticated) {
    const identityCardNumber = req.session.identityCardNumber;
    if (!identityCardNumber) {
      return res.status(400).send("Identity Card Number is required");
    }

    connection.query(
      "SELECT BirthDate FROM patients WHERE IdentityCardNumber = ?",
      [identityCardNumber],
      (err, result) => {
        if (err) {
          return res.status(500).send("Database Error");
        }

        if (result.length === 0) {
          return res.status(404).send("Patient not found");
        }

        const birthDate = new Date(result[0].BirthDate);
        const age = calculateage(birthDate);

        // 先獲取所有疫苗信息
        connection.query("SELECT * FROM Vaccine", (err, vaccines) => {
          if (err) {
            return res.status(500).send("Database Error");
          }

          // 查詢每種疫苗的測驗結果
          const testResultsQuery =
            "SELECT vaccine_name, passed FROM answer_records WHERE IdentityCardNumber = ?";
          connection.query(
            testResultsQuery,
            [identityCardNumber],
            (testErr, testResults) => {
              if (testErr) {
                return res.status(500).send("Error fetching test results");
              }

              // 建立一個map，用於儲測驗結果
              const testResultsMap = new Map();
              testResults.forEach((result) => {
                testResultsMap.set(result.vaccine_name, result.passed);
                console.log("Map set:", result.vaccine_name, result.passed);
              });
              console.log(testResultsMap);
              const categories = {
                past: [],
                withinYear: [],
                future: [],
              };

              vaccines.forEach((vaccine) => {
                const { startMonths, endMonths } = parseVaccinationTime(
                  vaccine.VaccinationTime
                );
                const startAgeInYears = startMonths / 12;
                const endAgeInYears = endMonths / 12;

                // 將測驗結果添加到對應的疫苗信息中
                vaccine.testResult = testResultsMap.get(vaccine.vaccinename);
                console.log(vaccine.vaccinename, vaccine.testResult);
                console.log(vaccines);

                if (age > endAgeInYears) {
                  categories.past.push(vaccine);
                } else if (age + 1 < startAgeInYears) {
                  categories.future.push(vaccine);
                } else {
                  categories.withinYear.push(vaccine);
                }
              });

              res.render("home", { categories });
            }
          );
        });
      }
    );
  } else {
    res.redirect("/login");
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
    const age = calculateAge(birthDate); 
    res.json({ age });
  });
});

//分類疫苗路由
app.get("/vaccines", (req, res) => {
  const identityCardNumber = req.session.identityCardNumber;
  if (!identityCardNumber) {
    return res.status(400).send("Identity Card Number is required");
  }

  db.query(
    "SELECT BirthDate FROM patient WHERE IdentityCardNumber = ?",
    [identityCardNumber],
    (err, result) => {
      if (err) {
        return res.status(500).send("Database Error");
      }

      if (result.length === 0) {
        return res.status(404).send("Patient not found");
      }

      const birthDate = new Date(result[0].BirthDate);
      const age = calculateage(birthDate); // 年齡以年為單位

      db.query("SELECT * FROM Vaccine", (err, vaccines) => {
        if (err) {
          return res.status(500).send("Database Error");
        }

        const categories = {
          past: [],
          withinYear: [],
          future: [],
        };

        vaccines.forEach((vaccine) => {
          const recommendedAgeInMonths = parseVaccinationTime(
            vaccine.VaccinationTime
          );
          const recommendedAgeInYears = recommendedAgeInMonths / 12;

          if (age > recommendedAgeInYears) {
            categories.past.push(vaccine);
          } else if (age + 1 > recommendedAgeInYears) {
            categories.withinYear.push(vaccine);
          } else {
            categories.future.push(vaccine);
          }
        });

        res.render("home", { categories });
      });
    }
  );
});

//登出
app.get("/logout", (req, res) => {
  if (req.session) {
    delete req.session.verificationCode;
  }
  res.render("login");
});

app.get("/test/:vaccinename", (req, res) => {
  const requestedVaccineName = req.params.vaccinename;
  connection.query("SELECT * FROM tests", (error, results) => {
    if (error) throw error;
    res.render("tests", {
      req: req,
      test: results,
      requestedVaccineName: requestedVaccineName,
    });
  });
});

app.post("/submit", (req, res) => {
  const submittedVaccineName = req.body.vaccine_name;
  let submittedAnswers = {};
  const identityCardNumber = req.session.identityCardNumber;

  if (!identityCardNumber) {
    return res.status(401).send("Unauthorized: No Identity Card Number");
  }

  // 從req.body解析出提交的答案
  for (let key in req.body) {
    if (key !== "vaccine_name") {
      const questionId = key.split("+")[0];
      submittedAnswers[questionId] = req.body[key];
    }
  }

  // 從資料庫中獲取正確答案
  const query = "SELECT id, correct_option FROM tests WHERE vaccine_name = ?";
  connection.query(query, [submittedVaccineName], (error, questions) => {
    if (error) {
      console.error("Error fetching questions:", error);
      res.status(500).send("Error fetching questions");
      return;
    }

    // 驗證答案
    let isPassed = true;
    const correctAnswers = {};
    questions.forEach((question) => {
      correctAnswers[question.id] = question.correct_option;
      if (submittedAnswers[question.id] !== question.correct_option) {
        isPassed = false;
      }
    });

    // 檢查該疫苗的答案記錄是否已存在
    const checkQuery =
      "SELECT id FROM answer_records WHERE vaccine_name = ? AND IdentityCardNumber = ?";
    connection.query(
      checkQuery,
      [submittedVaccineName, identityCardNumber],
      (checkError, checkResults) => {
        if (checkError) {
          console.error("Error checking existing record:", checkError);
          res.status(500).send("Error checking existing record");
          return;
        }

        let updateQuery;
        if (checkResults.length > 0) {
          // 如果記錄已存在，更新該記錄
          updateQuery =
            "UPDATE answer_records SET selected_option = ?, passed = ? WHERE vaccine_name = ? AND IdentityCardNumber = ?";
        } else {
          // 如果記錄不存在，插入新記錄
          updateQuery =
            "INSERT INTO answer_records (selected_option, passed, vaccine_name, IdentityCardNumber) VALUES (?, ?, ?, ?)";
        }

        // 執行更新或插入操作
        connection.query(
          updateQuery,
          [
            JSON.stringify(submittedAnswers),
            isPassed,
            submittedVaccineName,
            identityCardNumber,
          ],
          (insertError, insertResults) => {
            if (insertError) {
              console.error(
                "Error inserting/updating answer record:",
                insertError
              );
              res.status(500).send("Error inserting/updating answer record");
            } else {
              // 再次從資料庫中獲取所有問題並渲染頁面
              connection.query("SELECT * FROM tests", (error, results) => {
                if (error) {
                  console.error("Error fetching questions:", error);
                  res.status(500).send("Error fetching questions");
                } else {
                  res.render("tests", {
                    test: results,
                    requestedVaccineName: submittedVaccineName,
                    isPassed: isPassed,
                    correctAnswers: correctAnswers,
                    submittedAnswers: submittedAnswers,
                  });
                }
              });
            }
          }
        );
      }
    );
  });
});

function parseVaccinationTime(vaccinationTime) {
  // 假設 vaccinationTime 是這樣的格式："出生後5個月"
  // 解析這個字符串以獲得月份數

  /*const match = vaccinationTime.match(/(\d+)/);
  return match ? parseInt(match[1]) : 0;*/

  const matches = vaccinationTime.match(/(\d+)/g);
  if (matches && matches.length === 2) {
    // 有兩個數字，表示一個範圍
    const startMonths = parseInt(matches[0]);
    const endMonths = parseInt(matches[1]);
    return { startMonths, endMonths };
  } else if (matches) {
    // 只有一個數字，表示是單一時間點
    const months = parseInt(matches[0]);
    return { startMonths: months, endMonths: months };
  }

  return { startMonths: 0, endMonths: 0 };
}

//
// function calculateAge(birthDate) {
//   var now = new Date();
//   var birth = new Date(birthDate);
//   var age = now.getFullYear() - birth.getFullYear();
//   var m = now.getMonth() - birth.getMonth();
//   if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) {
//     age--;
//   }

//   var d = now.getDate() - birth.getDate();
//   if (d < 0) {
//     m--;
//     d += new Date(now.getFullYear(), now.getMonth(), 0).getDate();
//   }

//   return age + " 年 " + m + " 個月 " + d + " 天";
// }

function calculateAge(birthDate) {
  const now = new Date();
  const birth = new Date(birthDate);
  let age = now.getFullYear() - birth.getFullYear();
  let m = now.getMonth() - birth.getMonth();
  let d = now.getDate() - birth.getDate();

  if (d < 0) {
    m--;
    d += new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate(); 
  }
  if (m < 0) {
    age--;
    m += 12;
  }

  return age + " 年 " + m + " 個月 " + d + " 天";
}

function calculateage(birthDate) {
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  let monthDiff = today.getMonth() - birthDate.getMonth();

  // 如果當前月份還沒有到達生日月份，年齡減一
  if (monthDiff < 0) {
    age--;
    monthDiff += 12; // 補上未滿的一年的月份
  } else if (monthDiff === 0 && today.getDate() < birthDate.getDate()) {
    age--;
    monthDiff = 11; // 如果是同月但日期未到，月份應為11（因為已經過了整數年）
  }

  // 計算月份作為年齡的小數部分
  const ageWithMonths = age + monthDiff / 12;

  return ageWithMonths;
}

app.get("/", (req, res) => {
  res.render("login");
});

// 啟動服務器
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`服務器運行在端口${PORT}`);
});
