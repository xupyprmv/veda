var webdriver = require('selenium-webdriver'),
    basic = require('./basic.js'),
    assert = require('assert'),
    timeStamp = ''+Math.round(+new Date()/1000);

basic.getDrivers().forEach (function (drv) {
	var driver = basic.getDriver(drv);
	
	basic.openPage(driver, drv);
	basic.login(driver, 'karpovrt', '123', 'Роман', 'Карпов');
	
	basic.openCreateDocumentForm(driver, 'Идея', 'mnd-s-asppd:Idea');
	
	// Документ нельзя создать или отправить пока не заполнены обязательные поля
	driver.findElement({id:'save'}).isEnabled().then(function (flag) {
		assert(!flag);
	});
	
	// Заполняем обязательные поля
	driver.findElement({css:'[property="mnd-s:registrationNumber"] + veda-control input'}).sendKeys(timeStamp);
	driver.findElement({css:'[property="mnd-s:registrationNumber"] + veda-control input'}).sendKeys(webdriver.Key.ENTER);
	
	// Документ становится возможно сохранить
	driver.wait
	(
	  webdriver.until.elementIsEnabled(driver.findElement({id:'save'})),
	  basic.FAST_OPERATION
	);
	
	driver.executeScript("document.getElementById('save').scrollIntoView(true);");
	
	// Нажимаем сохранить
	driver.findElement({id:'save'}).click();
	
	// Проверяем что сохранение успешно
	// Переходим на страницу просмотра документа
	var individualId = driver.findElement({css:'div[id="object"] > [typeof="mnd-s-asppd:Idea"]'}).getAttribute('resource').then(function (individualId) {
	basic.openPage(driver, drv, '#/'+individualId);	
	});
	
	// Смотрим что в нём содержится введённый ранее текст
	driver.findElement({css:'div[property="mnd-s:registrationNumber"] span[class="value-holder"]'}).getText().then(function (txt) {
		assert(txt == timeStamp);
	});
	
	// Открываем поисковый бланк
	basic.openFulltextSearchDocumentForm(driver, 'Идея', 'mnd-s-asppd:Idea');
	
	// Вводим текст запроса
	driver.findElement({css:'h4[about="v-fs:EnterQuery"]+div[class="form-group"] input'}).sendKeys(timeStamp);
	
	// Нажимаем поиск и удостоверяемся что в результатах поиска появился созданный выше документ  
	driver.wait
	(
	  function () {
		  driver.findElement({css:'h4[about="v-fs:EnterQuery"]+div[class="form-group"] button[id="submit"]'}).click();
	  driver.sleep(1000); // Иначе слишком часто щелкает поиск
	  return driver.findElement({css:'span[href="#params-ft"]+span[class="badge"]'}).getText().then(function (txt) {
		  return txt == '1';
		  });
	  },
	  basic.EXTRA_SLOW_OPERATION
	);
	
	driver.wait
	(  
	  webdriver.until.elementTextContains(driver.findElement({css:'div[id="search-results"] span[property="mnd-s:registrationNumber"]'}),timeStamp),
	  basic.FAST_OPERATION
	);
	
	driver.quit();
});