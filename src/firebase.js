import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyBIKVBhDPWZ770v8mD7XrS6wg7hB8NiGFM",
  authDomain: "smart-knee-capv4.firebaseapp.com",
  databaseURL: "https://smart-knee-capv4-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "smart-knee-capv4",
  storageBucket: "smart-knee-capv4.firebasestorage.app",
  messagingSenderId: "502146392075",
  appId: "1:502146392075:web:82be17944e833b3db1270e"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);