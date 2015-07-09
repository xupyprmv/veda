var connection = require('./connection.js'),
    driver = connection.driver,
    basic = require('./basic.js'),
    until = require('selenium-webdriver').until,
    By = require('selenium-webdriver').By;

basic.openPage(driver);
basic.login(driver);

driver.wait
(
  until.elementTextContains(driver.findElement(By.id('main')),'Добро пожаловать в Veda!'),
  2000
).then
(
  null,
  function(err)
  {
    console.trace(err);
    process.exit(1);
  }
);
driver.quit();