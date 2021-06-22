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

//******* GLOBALS *******

var res;
var message;
var response;

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
  let O_NR = event.O_NR;  //Ordernummer
  let orderitems = event.body;

  try {
    //Prüfen ob die Bestellungen existieren
    await callDBResonse(pool, checkOrderExist(O_NR));
    console.log(res);
    if (res == null) {
      message = 'Der Auftrag mit der Nummer ' + O_NR + ' wurde nicht gefunden.';

      response = {
        statusCode: 404,
        errorMessage: message,
        errorType: "Not Found"
      };

      //Fehler schmeisen
      context.fail(JSON.stringify(response));
    }
    else if (res[0].O_OST_NR != 9) {
      message = 'Es können nur Aufträge im Status Entwurf geändert werden.';

      response = {
        statusCode: 400,
        errorMessage: message,
        errorType: "Bad Request"
      };
      //Fehler schmeisen
      context.fail(JSON.stringify(response));
    }
    else {
      //Image löschen
      await callDB(pool, deleteOrderImages(O_NR));

      //QualityIssues löschen
      await callDB(pool, deleteOrderQualityIssue(O_NR));

      //Return Items löschen
      await callDB(pool, deleteOrderItemreturn(O_NR));

      //Orderitems löschen
      await callDB(pool, deleteOrderItems(O_NR));


      //Neue Orderitems anlegen
      for (var i = 0; i < orderitems.length; i++) {
        //Prüfen, ob Orderitems in MaWi existieren ...
        await callDB(pool, insertNewOrderitem(O_NR, orderitems[i].OI_NR, 1, orderitems[i].OI_MATERIALDESC, orderitems[i].OI_HEXCOLOR, orderitems[i].OI_QTY, orderitems[i].OI_PRICE, orderitems[i].OI_VAT));

        //Bild anlegen
        await callDB(pool, insertNewImage(O_NR, orderitems[i].OI_NR, 1, orderitems[i].IM_FILE));
      }

      var messageJSON = {
        message: 'Der Auftrag wurde geändert.'
      };

      response = {
        statusCode: 200,
        message: JSON.stringify(messageJSON)
      };
      return response;
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

//******* SQL Statements *******

const checkOrderExist = function (O_NR) {
  var queryMessage = "SELECT * FROM ORDER.ORDER WHERE O_NR='" + O_NR + "';";
  //console.log(queryMessage);
  return (queryMessage);
};

const deleteOrderItems = function (O_NR) {
  var queryMessage = "DELETE FROM `ORDER`.`ORDERITEM` WHERE (`OI_O_NR` = '" + O_NR + "');";
  //console.log(queryMessage);
  return (queryMessage);
};

const deleteOrderImages = function (O_NR) {
  var queryMessage = "DELETE FROM `ORDER`.`IMAGE` WHERE (`IM_O_NR` = '" + O_NR + "');";
  //console.log(queryMessage);
  return (queryMessage);
};

const insertNewOrderitem = function (OI_O_NR, OI_NR, OI_IST_NR, OI_MATERIALDESC, OI_HEXCOLOR, OI_QTY, OI_PRICE, OI_VAT) {
  var queryMessage = "INSERT INTO `ORDER`.`ORDERITEM` (OI_O_NR, OI_NR, OI_IST_NR, OI_MATERIALDESC, OI_HEXCOLOR, OI_QTY, OI_PRICE, OI_VAT) VALUES ('" + OI_O_NR + "', '" + OI_NR + "', '" + OI_IST_NR + "', '" + OI_MATERIALDESC + "', '" + OI_HEXCOLOR + "', '" + OI_QTY + "', '" + OI_PRICE + "', '" + OI_VAT + "');";
  //console.log(queryMessage);
  return (queryMessage);
};

const deleteOrderItemreturn = function (O_NR) {
  var queryMessage = "DELETE * FROM `QUALITY`.`ITEMRETURN` WHERE IR_O_NR='" + O_NR + "';";
  //console.log(queryMessage);
  return (queryMessage);
};

const deleteOrderQualityIssue = function (O_NR) {
  var queryMessage = "DELETE * FROM `QUALITY`.`QUALITYISSUE` WHERE QI_O_NR='" + O_NR + "';";
  //console.log(queryMessage);
  return (queryMessage);
};

const insertNewImage = function (IM_O_NR, IM_OI_NR, IM_POSITION, IM_FILE) {
  var queryMessage = "INSERT INTO `ORDER`.`IMAGE` (IM_O_NR, IM_OI_NR, IM_POSITION, IM_FILE) VALUES ('" + IM_O_NR + "', '" + IM_OI_NR + "', '" + IM_POSITION + "', '" + IM_FILE + "');";
  //console.log(queryMessage);
  return (queryMessage);
};