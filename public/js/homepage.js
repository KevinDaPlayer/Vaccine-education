document.addEventListener("DOMContentLoaded", function () {
  fetch("http://localhost:3000/getAge")
    .then((response) => {
      if (!response.ok) {
        throw new Error("無法獲取年齡數據");
      }
      return response.json();
    })
    .then((data) => {
      document.getElementById("ageDisplay").innerText = `年齡: ${data.age}`;
    })
    .catch((error) => {
      console.error("錯誤:", error);
    });
});
