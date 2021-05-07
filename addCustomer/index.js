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
  let C_NR=Math.floor(Math.random() * 1000);
  //let C_CT_ID = ""+Math.floor(Math.random() * 100);
  let C_CT_ID = "10";
  let C_COMPANY = event.company;
  let C_FIRSTNAME = event.firstName;
  let C_LASTNAME = event.surName;
  let C_CO_ID = "20";
  let C_STREET = event.street;
  let C_CI_PC = event.PostCode;
  let C_HOUSENR = event.number;
  let C_EMAIL = event.mail;
  let C_TEL = event.phone;
  
  //let city = event.city;
  //let country = event.country;
  //let business = event.business;
  
  let idPERSON = Math.floor(Math.random() * 1000);
  let Name = event.firstName;
  
  
  //await callinsertDB(pool, insertOrdinaryCustomer(C_NR , C_CT_ID, C_COMPANY, C_FIRSTNAME, C_LASTNAME, C_CO_ID, C_CI_PC, C_STREET, C_HOUSENR, C_EMAIL, C_TEL));
  
  //Test Person
  await callinsertDB(pool, insertPerson(idPERSON, Name));
  
  message = 'Die/Der Kund/inn/e ' + C_FIRSTNAME + ' ' + C_LASTNAME + ' hat die Kundennummer: ' + C_NR + '.';

  const response = {
    statusCode: 200,
    //body: JSON.stringify('Hello from Lambda!'),
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
}


//Test Person
const insertPerson = function (idPERSON, Name) {
  var queryMessage = "INSERT INTO `CUSTOMER`.`PERSON` (`idPERSON`, `Name`) VALUES ('"+idPERSON+"', '"+Name+"');";
  console.log(queryMessage);
  return (queryMessage);
};