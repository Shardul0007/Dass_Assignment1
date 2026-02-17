const bcrypt = require("bcryptjs");
console.log(bcrypt.hashSync("admin123", 10));
(async () => {
  const hash = "$2b$10$x/2pyxT9Coq8pDfcITEtzuwTM0MxCHqX/.d9x5aOstokSJrQ8y.Py";
  console.log(await bcrypt.compare("admin123", hash));
})();
