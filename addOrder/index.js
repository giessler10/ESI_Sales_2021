/*-----------------------------------------------------------------------*/
// Autor: ESI SoSe21 - Team sale & shipping
// University: University of Applied Science Offenburg
// Members: Tobias Gießler, Christoph Werner, Katarina Helbig, Aline Schaub
// Contact: ehelbig@stud.hs-offenburg.de, saline@stud.hs-offenburg.de,
//          cwerner@stud.hs-offenburg.de, tgiessle@stud.hs-offenburg.de
/*-----------------------------------------------------------------------*/

//******* IMPORTS *******

const mysql = require('mysql2/promise');
var config = require('./config');
const axios = require('axios');


//******* GLOBALS *******

var res;
var message;
var response;
var body_production;
var orderitemProduce = [];
var body_mawi;
var orderitemMaWi = [];
var stored = false;

var OI_O_NR; //Bestellnummer
var C_CT_ID; //Kundentyp
var O_TIMESTAMP; //Zeit
var PO_CODE;
var orderitemIndex;

//******* DATABASE CONNECTION *******

const con = {
  host: config.host,
  user: config.user,
  password: config.password,
  port: config.port,
};

//******* EXPORTS HANDLER  *******

exports.handler = async (event, context, callback) => {
  const pool = await mysql.createPool(con);

  // get event data
  let O_C_NR = event.C_NR;        //Kundennummer
  let draft = event.draft;        //Entwurf
  let orderitems = event.orderitems;

  try {
    //Prüfen ob der User existiert
    await callDBResonse(pool, checkUserExist(O_C_NR));
    if (res == null) {
      message = 'Der Kunde mit der Kundennummer ' + O_C_NR + ' wurde nicht gefunden.';

      response = {
        statusCode: 404,
        errorMessage: message,
        errorType: "Not Found"
      };

      //Fehler schmeisen
      context.fail(JSON.stringify(response));
    }
    else {
      orderitemProduce = [];
      orderitemMaWi = [];

      //Vorproduktion
      if (O_C_NR == 0) {
        PO_CODE = "P";  //P=Preprocessing

        //Aktuelles Datum
        const date = new Date();
        const inc = (1000 * 60 * 60) * 2; // an hour
        const _date = new Date(date);
        O_TIMESTAMP = new Date(_date.getTime() + inc).toISOString().slice(0, 19).replace('T', ' ');

        //Index abfragen
        await callDBResonse(pool, getOrderitemIndex(0));
        orderitemIndex = res[0].orderitemIndex;

        body_production = buildRequestBodyNewPreOrder(0, "B2B", O_TIMESTAMP, PO_CODE, orderitems, orderitemIndex);
        await postProductionOrder(body_production);

        //Sleep
        await sleep(100);

        //Orderitems anlegen
        for (var i = 0; i < orderitems.length; i++) {
          orderitemIndex += 1;

          await callDB(pool, insertNewOrderitem(0, orderitemIndex, 1, orderitems[i].OI_MATERIALDESC, orderitems[i].OI_HEXCOLOR, orderitems[i].OI_QTY, orderitems[i].OI_PRICE, orderitems[i].OI_VAT));

          //Bild anlegen
          await callDB(pool, insertNewImage(0, orderitemIndex, 1, orderitems[i].IM_FILE));
        }

        message = 'Die Vorproduktion wurde angelegt.';

        var messageJSON = {
          message: message
        };

        response = {
          statusCode: 200,
          message: JSON.stringify(messageJSON)
        };
        return response;
      }
      else {
        //N=NEW
        PO_CODE = "N";

        //Bestellung als Enwurf anlegen
        if (draft == true) {
          await callDB(pool, insertNewOrder(O_C_NR, 9));

          //Neue Bestellnummer abfragen
          await callDBResonse(pool, getNewOrderID());
          OI_O_NR = res[0].neworderID;

          //Orderitems anlegen
          for (var i = 0; i < orderitems.length; i++) {

            await callDB(pool, insertNewOrderitem(OI_O_NR, orderitems[i].OI_NR, 1, orderitems[i].OI_MATERIALDESC, orderitems[i].OI_HEXCOLOR, orderitems[i].OI_QTY, orderitems[i].OI_PRICE, orderitems[i].OI_VAT));

            //Sleep
            await sleep(100);

            //Bild anlegen
            await callDB(pool, insertNewImage(OI_O_NR, orderitems[i].OI_NR, 1, orderitems[i].IM_FILE));
          }
        }
        //Bestellung direkt an Produktion weiterleiten
        else {
          await callDB(pool, insertNewOrder(O_C_NR, 9));

          //Neue Bestellnummer abfragen
          await callDBResonse(pool, getNewOrderID());
          OI_O_NR = res[0].neworderID;

          //Orderitems anlegen
          for (var i = 0; i < orderitems.length; i++) {

            await callDB(pool, insertNewOrderitem(OI_O_NR, orderitems[i].OI_NR, 1, orderitems[i].OI_MATERIALDESC, orderitems[i].OI_HEXCOLOR, orderitems[i].OI_QTY, orderitems[i].OI_PRICE, orderitems[i].OI_VAT));

            //Sleep
            await sleep(100);

            //Bild anlegen
            await callDB(pool, insertNewImage(OI_O_NR, orderitems[i].OI_NR, 1, orderitems[i].IM_FILE));
          }

          //Sleep
          await sleep(100);

          //Prüfen, ob Orderitems in MaWi existieren *************************************
          for (var i = 0; i < orderitems.length; i++) {
            stored = false;

            body_mawi = buildRequestBodyOrderMaWi(OI_O_NR, PO_CODE, orderitems[i]);
            await putOrderAvailability(body_mawi);

            if (stored) {
              //Wenn verfügbar, dem Array orderitemMaWi hinzufügen
              orderitemMaWi.push(orderitems[i]);
            }
            else {
              //Zu den zu produzierenden Orderitems für die Produktion hinzufügen
              orderitemProduce.push(orderitems[i]);
            }

            //Sleep
            await sleep(300);
          }


          //Aufträge bei der Produktion anlegen ******************************************
          if (orderitemProduce.length != 0) {
            //Neue Bestellnummer abfragen
            //Sleep
            await sleep(100);

            await callDBResonse(pool, detectBusiness(O_C_NR));
            C_CT_ID = res[0].C_CT_ID;

            //Datum bestimmen
            await callDBResonse(pool, detectTimestamp(OI_O_NR));
            O_TIMESTAMP = res[0].O_TIMESTAMP;

            body_production = buildRequestBodyNewOrder(OI_O_NR, C_CT_ID, O_TIMESTAMP, PO_CODE, orderitemProduce);
            console.log(body_production);
            await postProductionOrder(body_production);

          }

          //Sleep
          await sleep(100);

          //Wenn DB bei Produktion und MaWi online ist und der Auftrag übermittelt wurde ***********************************************

          //Order aktualisieren
          await callDB(pool, updateOrderStatus(OI_O_NR, 1));

          //Orderitems die verfügbar waren aktualisieren
          for (var i = 0; i < orderitemMaWi.length; i++) {
            await callDB(pool, updateOrderitemStatus(OI_O_NR, orderitemMaWi[i].OI_NR, 5));
          }
        }

        //Sleep
        await sleep(100);

        //Neue Bestellnummer abfragen
        await callDBResonse(pool, getNewOrderID());
        message = 'Der neue Auftrag hat die Nummer ' + res[0].neworderID + '.';

        var messageJSON = {
          message: message
        };

        response = {
          statusCode: 200,
          message: JSON.stringify(messageJSON)
        };
        return response;

      }

    }

  }
  catch (error) {
    console.log(error);

    response = {
      statusCode: 500,
      errorMessage: "Internal Server Error",
      errorType: "Internal Server Error"
    };

    //Fehler schmeisen
    context.fail(JSON.stringify(response));
  }
  finally {
    await pool.end();
  }
};

//******* DB Call Functions *******

async function callDB(client, queryMessage) {
  await client.query(queryMessage)
    .catch(console.log);
}

async function callDBResonse(client, queryMessage) {
  var queryResult = 0;
  await client.query(queryMessage)
    .then(
      (results) => {
        queryResult = results[0];
        return queryResult;
      })
    .then(
      (results) => {
        //Prüfen, ob queryResult == []
        if (!results.length) {
          //Kein Eintrag in der DB gefunden
          res = null;
        }
        else {
          res = JSON.parse(JSON.stringify(results));
          return results;
        }
      })
    .catch();
}

//************ Hilfsfunktionen ************
const buildRequestBodyOrderMaWi = function (OI_O_NR, PO_CODE, orderitem) {
  var body = [];
  var currentOrder = {
    O_NR: OI_O_NR,
    OI_NR: orderitem.OI_NR,
    PO_CODE: PO_CODE,
    PO_COUNTER: 1,
    QUANTITY: orderitem.OI_QTY,
    HEXCOLOR: orderitem.OI_HEXCOLOR,
    IMAGE: orderitem.IM_FILE
  };
  body.push(currentOrder);

  var resonse = {
    body: body
  };

  //console.log(resonse);
  return JSON.stringify(resonse);
};

const buildRequestBodyNewOrder = function (OI_O_NR, C_CT_ID, O_TIMESTAMP, PO_CODE, orderitems) {
  var order;
  var body = [];
  var customerType;

  if (C_CT_ID == "B2C") {
    customerType = "P";
  }
  else {
    customerType = "B";
  }

  for (var i = 0; i < orderitems.length; i++) {
    order = {
      O_NR: OI_O_NR,
      OI_NR: orderitems[i].OI_NR,
      PO_CODE: PO_CODE,
      PO_COUNTER: 1,
      QUANTITY: orderitems[i].OI_QTY,
      CUSTOMER_TYPE: customerType,
      O_DATE: O_TIMESTAMP,
      IMAGE: orderitems[i].IM_FILE,
      HEXCOLOR: orderitems[i].OI_HEXCOLOR
    };
    body.push(order);
  }
  return JSON.stringify(body);
};

const buildRequestBodyNewPreOrder = function (OI_O_NR, C_CT_ID, O_TIMESTAMP, PO_CODE, orderitems, orderitemIndex) {
  var order;
  var body = [];
  var customerType;
  var currentOrderitemIndex = orderitemIndex;

  if (C_CT_ID == "B2C") {
    customerType = "P";
  }
  else {
    customerType = "B";
  }

  for (var i = 0; i < orderitems.length; i++) {
    currentOrderitemIndex += 1;
    order = {
      O_NR: OI_O_NR,
      OI_NR: currentOrderitemIndex,
      PO_CODE: PO_CODE,
      PO_COUNTER: 1,
      QUANTITY: orderitems[i].OI_QTY,
      CUSTOMER_TYPE: customerType,
      O_DATE: O_TIMESTAMP,
      IMAGE: orderitems[i].IM_FILE,
      HEXCOLOR: orderitems[i].OI_HEXCOLOR
    };
    body.push(order);
  }
  return JSON.stringify(body);
};

//Check if database is offline (AWS)
const IsDataBaseOffline = function (res) {

  if (res.data.errorMessage == null) return false;
  if (res.data.errorMessage === 'undefined') return false;
  if (res.data.errorMessage.endsWith("timed out after 3.00 seconds")) {
    return true;
  }
  return false;
};

const sleep = ms => {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
};

//************ API Call Production ************

async function postProductionOrder(body) {
  let parsed;
  //console.log(body);

  await axios.post('https://1ygz8xt0rc.execute-api.eu-central-1.amazonaws.com/main/createorder', body)
    .then((results) => {

      /*
      if(IsDataBaseOffline(results)){
        response = {
          statusCode: 500,
          errorMessage: "Internal Server Error",
          errorType: "Internal Server Error"
        };
      
        //Fehler schmeisen
        context.fail(JSON.stringify(response));
        
        return; //Check if db is available
      }
      */

      parsed = JSON.stringify(results.data);
      //console.log(parsed);
      res = JSON.parse(parsed);
      res = res.body;
      //console.log(res);
      return results;
    })
    .catch((error) => {
      console.error(error);
    });
}

//************ API Call MaWi ************

async function putOrderAvailability(body) {
  let parsed;

  await axios.put('https://9j8oo3h3yk.execute-api.eu-central-1.amazonaws.com/Main/putvorproduktion', body)
    .then((results) => {

      /*
      if(IsDataBaseOffline(results)){
        stored = false;
        
        response = {
          statusCode: 500,
          errorMessage: "Internal Server Error",
          errorType: "Internal Server Error"
        };
      
        //Fehler schmeisen
        context.fail(JSON.stringify(response));

        return; //Check if db is available
      }
      */

      parsed = JSON.stringify(results.data);
      //console.log(parsed);
      res = JSON.parse(parsed);
      stored = res.stored;
      return results;
    })
    .catch((error) => {
      console.error(error);
    });
}

//******* SQL Statements *******

const insertNewOrder = function (O_C_NR, O_OST_NR) {
  var queryMessage = "INSERT INTO `ORDER`.`ORDER` (O_C_NR, O_OST_NR) VALUES ('" + O_C_NR + "', '" + O_OST_NR + "');";
  //console.log(queryMessage);
  return (queryMessage);
};

const insertNewOrderitem = function (OI_O_NR, OI_NR, OI_IST_NR, OI_MATERIALDESC, OI_HEXCOLOR, OI_QTY, OI_PRICE, OI_VAT) {
  var queryMessage = "INSERT INTO `ORDER`.`ORDERITEM` (OI_O_NR, OI_NR, OI_IST_NR, OI_MATERIALDESC, OI_HEXCOLOR, OI_QTY, OI_PRICE, OI_VAT) VALUES ('" + OI_O_NR + "', '" + OI_NR + "', '" + OI_IST_NR + "', '" + OI_MATERIALDESC + "', '" + OI_HEXCOLOR + "', '" + OI_QTY + "', '" + OI_PRICE + "', '" + OI_VAT + "');";
  //console.log(queryMessage);
  return (queryMessage);
};

const getNewOrderID = function () {
  var queryMessage = "SELECT max(O_NR) as neworderID FROM ORDER.ORDER;";
  //console.log(queryMessage);
  return (queryMessage);
};

const checkUserExist = function (C_NR) {
  var queryMessage = "SELECT * FROM CUSTOMER.CUSTOMER WHERE C_NR='" + C_NR + "';";
  //console.log(queryMessage);
  return (queryMessage);
};

const detectBusiness = function (C_NR) {
  var queryMessage = "SELECT C_CT_ID FROM CUSTOMER.CUSTOMER WHERE C_NR='" + C_NR + "';";
  //console.log(queryMessage);
  return (queryMessage);
};

const detectTimestamp = function (OI_O_NR) {
  var queryMessage = "SELECT O_TIMESTAMP FROM ORDER.ORDER WHERE O_NR='" + OI_O_NR + "';";
  //console.log(queryMessage);
  return (queryMessage);
};

const insertNewImage = function (IM_O_NR, IM_OI_NR, IM_POSITION, IM_FILE) {
  var queryMessage = "INSERT INTO `ORDER`.`IMAGE` (IM_O_NR, IM_OI_NR, IM_POSITION, IM_FILE) VALUES ('" + IM_O_NR + "', '" + IM_OI_NR + "', '" + IM_POSITION + "', '" + IM_FILE + "');";
  //console.log(queryMessage);
  return (queryMessage);
};

const updateOrderStatus = function (O_NR, O_OST_NR) {
  var queryMessage = "UPDATE `ORDER`.`ORDER` SET `O_OST_NR` = '" + O_OST_NR + "' WHERE (`O_NR` = '" + O_NR + "');";
  //console.log(queryMessage);
  return (queryMessage);
};

const getOrderitemIndex = function (O_NR) {
  var queryMessage = "SELECT max(OI_NR) as orderitemIndex FROM ORDER.ORDERITEM WHERE OI_O_NR='" + O_NR + "';";
  //console.log(queryMessage);
  return (queryMessage);
};

const updateOrderitemStatus = function (OI_O_NR, OI_NR, OI_IST_NR) {
  var queryMessage = "UPDATE ORDER.ORDERITEM SET OI_IST_NR = " + OI_IST_NR + " WHERE OI_O_NR = " + OI_O_NR + " AND OI_NR = " + OI_NR + ";";
  //console.log(queryMessage);
  return (queryMessage);
};