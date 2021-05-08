///////////////////////////////////// IMPORTS ///////////////////////////////////////

const mysql = require('mysql2/promise');
var config = require('./config');


///////////////////////////////////// GLOBALS ///////////////////////////////////////

var res;
var message;

///////////////////////////////////// DATABASE CONNECTION ///////////////////////////////////////

const con = {
  host: config.host,
  user: config.user,
  password: config.password,
  port: config.port,
};

/////////////////////////////////////EXPORTS HANDLER///////////////////////////////////////

exports.handler = async (event, context, callback) => {
  const pool = await mysql.createPool(con);

  // get event data
  let C_NR=Math.floor(Math.random() * 1000);    //CustomerNr
  let C_CT_ID = "1";  //Customer TypeID | 1=Privat | 2=Business
  let C_FIRSTNAME = event.C_FIRSTNAME;
  let C_LASTNAME = event.C_LASTNAME;
  let C_STREET = event.C_STREET;
  let C_HOUSENR = event.C_HOUSENR;
  let C_CI_PC = event.C_CI_PC;  //Customer Post Code
  let CI_DESC = event.CI_DESC;  //City Description
  let C_CO_ID = "1"; //Country ID | 1=Deutschland
  let CO_DESC = event.CO_DESC;  //Country
  let C_TEL = event.C_TEL;
  let C_EMAIL = event.C_EMAIL;
  let C_COMPANY = event.C_COMPANY;  //Firma
  //let business = event.business;

  await callinsertDB(pool, insertOrdinaryCustomer(C_NR , C_CT_ID, C_COMPANY, C_FIRSTNAME, C_LASTNAME, C_CO_ID, C_CI_PC, C_STREET, C_HOUSENR, C_EMAIL, C_TEL));

  message = 'Die/Der Kund/inn/e ' + C_FIRSTNAME + ' ' + C_LASTNAME + ' hat die Kundennummer: ' + C_NR + '.';

  const response = {
    statusCode: 200,
    boby: JSON.stringify(message),
  };
  return response;
};


const insertOrdinaryCustomer = function (C_NR , C_CT_ID, C_COMPANY, C_FIRSTNAME, C_LASTNAME, C_CO_ID, C_CI_PC, C_STREET, C_HOUSENR, C_EMAIL, C_TEL) {
  var queryMessage = "INSERT INTO `CUSTOMER`.`CUSTOMER` (C_NR , C_CT_ID, C_COMPANY, C_FIRSTNAME, C_LASTNAME, C_CO_ID, C_CI_PC, C_STREET, C_HOUSENR, C_EMAIL, C_TEL) VALUES ('" + C_NR + "', '" + C_CT_ID + "', '" + C_COMPANY + "', '" + C_FIRSTNAME + "', '" + C_LASTNAME + "', '" + C_CO_ID + "', '" + C_CI_PC + "', '" + C_STREET + "', '" + C_HOUSENR + "', '" + C_EMAIL + "', '" + C_TEL + "');";
  console.log(queryMessage);
  return (queryMessage);
};

async function callinsertDB(client, queryMessage) {
  await client.query(queryMessage)
    .catch(console.log);
};