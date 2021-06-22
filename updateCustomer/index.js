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
  let C_NR = event.C_NR; //Kundennummer
  let C_CT_ID = event.body.C_CT_ID;  //Customer TypeID | B2B=Privat | B2C=Business
  let C_COMPANY = event.body.C_COMPANY;  //Firma
  let C_FIRSTNAME = event.body.C_FIRSTNAME;
  let C_LASTNAME = event.body.C_LASTNAME;
  let C_STREET = event.body.C_STREET;
  let C_HOUSENR = event.body.C_HOUSENR;
  let C_CI_PC = event.body.C_CI_PC;  //Customer Post Code
  let CI_DESC = event.body.CI_DESC;  //City Description
  let C_CO_ID = event.body.CO_ID;    //Country ID | DE=Deutschland
  let C_TEL = event.body.C_TEL;
  let C_EMAIL = event.body.C_EMAIL;


  try {
    //Prüfen ob der User existiert
    await callDBResonse(pool, checkUserExist(C_NR));
    if (res == null) {
      message = 'Der Kunde mit der Kundennummer ' + C_NR + ' wurde nicht gefunden.';

      response = {
        statusCode: 404,
        errorMessage: message,
        errorType: "Not Found"
      };

      //Fehler schmeisen
      context.fail(JSON.stringify(response));
    }
    else {
      await callDBResonse(pool, checkCityExist(C_CO_ID, C_CI_PC));
      if (res == null) {
        //Neue City anlegen
        //console.log("Neuer Eintrag in City erstellt.")
        await callDB(pool, insertNewCity(C_CO_ID, C_CI_PC, CI_DESC));
      }

      //Kunden aktualisieren
      await callDB(pool, updateCustomer(C_NR, C_CT_ID, C_COMPANY, C_FIRSTNAME, C_LASTNAME, C_CO_ID, C_CI_PC, C_STREET, C_HOUSENR, C_EMAIL, C_TEL));

      var messageJSON = {
        message: 'Die/Der Kund/inn/e ' + C_FIRSTNAME + ' ' + C_LASTNAME + ' wurde aktualisiert.'
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
          res = JSON.parse(JSON.stringify(results[0]));
          return results;
        }
      })
    .catch();
}


//******* SQL Statements *******

const updateCustomer = function (C_NR, C_CT_ID, C_COMPANY, C_FIRSTNAME, C_LASTNAME, C_CO_ID, C_CI_PC, C_STREET, C_HOUSENR, C_EMAIL, C_TEL) {
  var queryMessage = "UPDATE `CUSTOMER`.`CUSTOMER` SET `C_CT_ID` = '" + C_CT_ID + "', `C_COMPANY` = '" + C_COMPANY + "', `C_FIRSTNAME` = '" + C_FIRSTNAME + "', `C_LASTNAME` = '" + C_LASTNAME + "', `C_CO_ID` = '" + C_CO_ID + "', `C_CI_PC` = '" + C_CI_PC + "', `C_STREET` = '" + C_STREET + "', `C_HOUSENR` = '" + C_HOUSENR + "', `C_EMAIL` = '" + C_EMAIL + "', `C_TEL` = '" + C_TEL + "' WHERE (`C_NR` = '" + C_NR + "')";

  console.log(queryMessage);
  return (queryMessage);
};

const insertNewCity = function (C_CO_ID, C_CI_PC, CI_DESC) {
  var queryMessage = "INSERT INTO `CUSTOMER`.`CITY` (`CI_CO_ID`, `CI_PC`, `CI_DESC`) VALUES ('" + C_CO_ID + "', '" + C_CI_PC + "', '" + CI_DESC + "');";
  console.log(queryMessage);
  return (queryMessage);
};

const checkCityExist = function (C_CO_ID, C_CI_PC) {
  var queryMessage = "SELECT * FROM CUSTOMER.CITY WHERE CI_CO_ID = '" + C_CO_ID + "' AND CI_PC = '" + C_CI_PC + "';";
  console.log(queryMessage);
  return (queryMessage);
};

const checkUserExist = function (C_NR) {
  var queryMessage = "SELECT * FROM CUSTOMER.CUSTOMER WHERE C_NR='" + C_NR + "';";
  console.log(queryMessage);
  return (queryMessage);
};
