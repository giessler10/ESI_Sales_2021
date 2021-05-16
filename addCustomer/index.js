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
  let C_CT_ID = event.C_CT_ID;  //Customer TypeID | B2B=Privat | B2C=Business
  let C_COMPANY = event.C_COMPANY;  //Firma
  let C_FIRSTNAME = event.C_FIRSTNAME;
  let C_LASTNAME = event.C_LASTNAME;
  let C_STREET = event.C_STREET;
  let C_HOUSENR = event.C_HOUSENR;
  let C_CI_PC = event.C_CI_PC;  //Customer Post Code
  let CI_DESC = event.CI_DESC;  //City Description
  let C_CO_ID = event.CO_ID;    //Country ID | DE=Deutschland
  let C_TEL = event.C_TEL;
  let C_EMAIL = event.C_EMAIL;


  try{
        await callDBResonse(pool, checkCityExist(C_CO_ID, C_CI_PC));
        if(res == null){
          //Neue City anlegen
          //console.log("Neuer Eintrag in City erstellt.")
          await callDB(pool, insertNewCity(C_CO_ID, C_CI_PC, CI_DESC));
        }
        
        //Neuen Kunden anlegen
        await callDB(pool, insertNewCustomer(C_CT_ID, C_COMPANY, C_FIRSTNAME, C_LASTNAME, C_CO_ID, C_CI_PC, C_STREET, C_HOUSENR, C_EMAIL, C_TEL));
        
        //Abfrage neue Kundennummer
        await callDBResonse(pool, getNewCustomerID());
        message = 'Die/Der Kund/inn/e ' + C_FIRSTNAME + ' ' + C_LASTNAME + ' hat die Kundennummer: '+ res.newcustomerID +'.';

        var messageJSON = {
        	message: message
        };
        
        response = {
        	statusCode: 200,
        	message: JSON.stringify(messageJSON)
        }; 
        return response;

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
        if(!results.length){
          //Kein Eintrag in der DB gefunden
          res = null;
        }
        else{
          res = JSON.parse(JSON.stringify(results[0]));
          return results;
        }
      })
    .catch();
}


//******* SQL Statements *******

const insertNewCustomer = function (C_CT_ID, C_COMPANY, C_FIRSTNAME, C_LASTNAME, C_CO_ID, C_CI_PC, C_STREET, C_HOUSENR, C_EMAIL, C_TEL) {
  var queryMessage = "INSERT INTO `CUSTOMER`.`CUSTOMER` (C_CT_ID, C_COMPANY, C_FIRSTNAME, C_LASTNAME, C_CO_ID, C_CI_PC, C_STREET, C_HOUSENR, C_EMAIL, C_TEL) VALUES ('" + C_CT_ID + "', '" + C_COMPANY + "', '" + C_FIRSTNAME + "', '" + C_LASTNAME + "', '" + C_CO_ID + "', '" + C_CI_PC + "', '" + C_STREET + "', '" + C_HOUSENR + "', '" + C_EMAIL + "', '" + C_TEL + "');";
  console.log(queryMessage);
  return (queryMessage);
};

const insertNewCity = function (C_CO_ID, C_CI_PC, CI_DESC) {
  var queryMessage = "INSERT INTO `CUSTOMER`.`CITY` (`CI_CO_ID`, `CI_PC`, `CI_DESC`) VALUES ('" + C_CO_ID + "', '" + C_CI_PC + "', '" + CI_DESC +"');";
  console.log(queryMessage);
  return (queryMessage);
};

const getNewCustomerID = function () {
    var queryMessage = "SELECT max(C_NR) as newcustomerID FROM CUSTOMER.CUSTOMER;";
    console.log(queryMessage);
    return (queryMessage);
};

const checkCityExist= function (C_CO_ID, C_CI_PC) {
    var queryMessage = "SELECT * FROM CUSTOMER.CITY WHERE CI_CO_ID = '"+ C_CO_ID + "' AND CI_PC = '" + C_CI_PC + "';";
    console.log(queryMessage);
    return (queryMessage);
};