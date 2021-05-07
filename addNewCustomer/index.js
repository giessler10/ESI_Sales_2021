var mysql = require('mysql');
var config = require('./salesDBconnection.json');

var pool  = mysql.createPool({
    host     : config.dbhost,
    user     : config.dbuser,
    password : config.dbpassword,
    database : config.dbname
  });



exports.handler = async (event) => {
    // TODO implement
    
    
     // get event data
    let firstName = event.firstName;
    let surName = event.surName;
    let company = event.company;
    let street = event.street;
    let PostCode = event.PostCode;
    let city = event.city;
    let country = event.country;
    let phone = event.phone;
    let mail = event.mail;
    let business = event.business;
    let newcustomerID;
    
    
    const response = {
        statusCode: 200,
        //body: JSON.stringify('Hello from Lambda!'),
        boby: JSON.stringify(firstName),
    };
    return response;
};

//V2
