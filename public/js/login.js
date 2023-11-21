function login() {
    var accountnumber = document.getElementById("account_number").value;
    var password = document.getElementById("password").value;

    
    if (accountnumber === "1234567891" && password === "123456") {
        alert("登入成功！");
        // 可以重定向到其他頁面或執行其他操作
        window.location.href = "home.html";
    } else {
        alert("登入失敗，請檢查用户名和密碼！");
    }
}
