const firebase = require("firebase/compat/app");
require("firebase/compat/storage")

const firebaseConfig = {
  apiKey: "AIzaSyBLAz03WO5UQPSUk9YwBf7lRur0JHAOxdM",
  authDomain: "printwear-design.firebaseapp.com",
  projectId: "printwear-design",
  storageBucket: "printwear-design.appspot.com",
  messagingSenderId: "558875867585",
  appId: "1:558875867585:web:0aa95775b59813778e9740",
};

const app = firebase.initializeApp(firebaseConfig);
const storageApp = firebase.storage().ref()

// const storageReference = storage.ref();

module.exports = storageApp;