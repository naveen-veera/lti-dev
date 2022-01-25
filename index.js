require('dotenv').config()
const path = require('path')
const routes = require('./src/routes')
const configKey = require('./config/keys.json');
const lti = require('ltijs').Provider

// Setup
lti.setup(process.env.LTI_KEY,
  {
    url: 'mongodb://' + process.env.DB_HOST + '/' + process.env.DB_NAME + '?authSource=admin',
    connection: { user: process.env.DB_USER, pass: process.env.DB_PASS }
  }, {
    ltiaas: true,
    appRoute: '/', 
    loginRoute: '/login',    
    logger: true,
    staticPath: path.join(__dirname, './public'), // Path to static files
    cookies: {
      secure: true, // Set secure to true if the testing platform is in a different domain and https is being used
      sameSite: 'None' // Set sameSite to 'None' if the testing platform is in a different domain and https is being used
    },
    devMode: false // Set DevMode to true if the testing platform is in a different domain and https is not being used
  })

// Whitelisting the main app route and /nolti to create a landing page
//lti.whitelist(lti.appRoute(), { route: new RegExp(/^\/nolti$/), method: 'get' }) // Example Regex usage
lti.whitelist('/status');
lti.whitelist('/assignmentIDMapping');
// When receiving successful LTI launch redirects to app, otherwise redirects to landing page
lti.onConnect(async (token, req, res, next) => {
 if (token) lti.redirect(res, '/redirect')
  else lti.redirect(res, '/nolti') // Redirects to landing page
})

// When receiving deep linking request redirects to deep link React screen
lti.onDeepLinking(async (connection, request, response) => {
  return lti.redirect(response, '/deeplink', { newResource: true })
})

// Setting up routes
lti.app.use(routes)

// Setup function
const setup = async () => {
  await lti.deploy({ port: process.env.PORT })

  /**
   * Register platform
   */
  /* await lti.registerPlatform({
    url: 'http://localhost/moodle',
    name: 'Platform',
    clientId: 'CLIENTID',
    authenticationEndpoint: 'http://localhost/moodle/mod/lti/auth.php',
    accesstokenEndpoint: 'http://localhost/moodle/mod/lti/token.php',
    authConfig: { method: 'JWK_SET', key: 'http://localhost/moodle/mod/lti/certs.php' }
  }) */
 const platform_1 =  await lti.registerPlatform(configKey['platforms']['platform_1']); 
 const platform_2 =  await lti.registerPlatform(configKey['platforms']['platform_2']);
 const platform_3 =  await lti.registerPlatform(configKey['platforms']['platform_3']);
 const platform_4 =  await lti.registerPlatform(configKey['platforms']['platform_4']);
 const platform_5 =  await lti.registerPlatform(configKey['platforms']['platform_5']);
 const platform_6 =  await lti.registerPlatform(configKey['platforms']['platform_6']);
 
 console.log("platform_1 ---->", await platform_1.platformPublicKey());
 console.log("platform_2 ---->", await platform_2.platformPublicKey());
 console.log("platform_3 ---->", await platform_3.platformPublicKey());
 console.log("platform_4 ---->", await platform_4.platformPublicKey());
 console.log("platform_5 ---->", await platform_5.platformPublicKey());
 console.log("platform_6 ---->", await platform_6.platformPublicKey());

 //console.log("plat1---->", await plat1.platformPublicKey());
}

setup()



