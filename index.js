var sendHTML = require('send-data/html');
// var baseurl = 'https://www.google.com/culturalinstitute/u/0/';
var h = require('hyperscript');
var imagedata = require('./imax.json');
var http = require('http');
var Router = require('http-hash-router');

var router = Router();

function template(img) {
  return h('html',
           h('head',
             h('link', {rel: "stylesheet", href:"css/tachyons.min.css", type:"text/css", media:"screen"}),
             h('link', {rel: "stylesheet", href:"css/style.css", type:"text/css", media:"screen"}),
             h('link', {rel: "stylesheet", href:"http://fonts.googleapis.com/css?family=Source+Sans+Pro:400,700"}),
             h('style', ".my-image {background: url("+img+"); background-size: cover; background-repeat: no-repeat;}"),
             h("meta", {"charset":"utf-8"}),
             h('meta', {name: "viewport", content: "width=device-width, initial-scale=1"})),
           h('body', {className: "wi-100 my-image", style: {
             'background': "url("+img+")"
           }},
             h('header', {className: "bb b--light-gray pvm"},
               h('div', {className: "center mw8 phm phl-ns"},
                 h('h1', {className: "f3 book dib prm"},
                   h('a', {className: "link", href:"/", title: "home"}, "another painting")),
                 h('h2', {className: "f4 book orange dib"},
                   h('i', "")))),
             h('main', {className: "center mw8 phm phl-ns pbxl"}
               // h('img', {className: "pas", src: img})
              )));
}

function getRandomImage() {
  return imagedata[Math.floor(Math.random()*imagedata.length)].image
}

router.set("/", function(req, res, opts) {
  sendHTML(req, res, template(getRandomImage()).outerHTML);
})

router.set("*", require("st")({
  path: __dirname + '/public',
  cache: false
}))

http.createServer(function handler(req, res) {
  router(req, res, {}, onErr);

  function onErr(err) {
    if (err) {
      res.statusCode = err.statusCode || 500;
      res.end(err.message);
    }
  }
}).listen(7777);

console.log('Server running on port: ', 7777);
