
import admin from "firebase-admin";


let db: admin.firestore.Firestore;
let adminAuth: admin.auth.Auth;
let storage: admin.storage.Storage;

if (!admin.apps.length) {
  try {
    
    if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
      
      // Clean up private key - remove any leading/trailing whitespace, ensure proper line breaks
      let privateKey = process.env.FIREBASE_PRIVATE_KEY;
      
      // Fix common issues: remove literal \n characters and replace with real ones, trim whitespace
      privateKey = privateKey.trim().replace(/\\n/g, "\n").replace(/\r/g, "");
      
      
      // Clean up key (remove any whitespace or trailing newlines, make sure it's properly formatted
      privateKey = privateKey.trim();
      if (!privateKey.startsWith("-----BEGIN PRIVATE KEY-----")) {
        // If it doesn't have the header, check if it's in the raw key and add it
        privateKey = "-----BEGIN PRIVATE KEY-----\n" + privateKey.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----/g, "").trim() + "\n-----END PRIVATE KEY-----";
      }
      
      // If it still doesn't end with the footer, add it
      if (!privateKey.endsWith("-----END PRIVATE KEY-----")) {
        privateKey = privateKey + "\n-----END PRIVATE KEY-----";
      }
      
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: privateKey,
        }),
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET || `${process.env.FIREBASE_PROJECT_ID}.appspot.com`,
      });
    } else {
      admin.initializeApp();
    }
    
    db = admin.firestore();
    db.settings({ ignoreUndefinedProperties: true });
    
    // Test the connection with a simple get
    const testDoc = db.collection("ordenes").limit(1).get();
    testDoc.then(() => {
      // Connection test successful
    }).catch((err) => {
      // Connection test failed
    });
    
    adminAuth = admin.auth();
    storage = admin.storage();
  } catch (err) {
    throw err;
  }
} else {
  db = admin.firestore();
  adminAuth = admin.auth();
  storage = admin.storage();
}

export { db, adminAuth, storage };
export default admin;
