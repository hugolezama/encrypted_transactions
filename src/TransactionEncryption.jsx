import React, { Component } from "react";
import CryptoJS from "crypto-js";
import JSEncrypt from "jsencrypt";
import axios from "axios";

class TransactionEncryption extends Component {
  constructor() {
    super();
    this.state = {
      type: "PAYMENT",
      amount: 10000,
      number: "4242424242424242",
      cvv: "123",
      expirationDate: "0822",
      log: "",
    };
  }

  doTransaction = () => {
    let request = {
      method: "get",
      url: "http://localhost:5000/api/transaction/public-key",
    };
    axios(request)
      .then((response) => {
        console.log("RSA public key[base64]: " + response.data.rsaPublicKey);

        let transaction = {
          transactionId: response.data.transactionId,
          type: this.state.type,
          amount: this.state.amount,
          creditCardDTO: {
            cardNumber: this.state.number,
            cvv: this.state.cvv,
            expirationDate: this.state.expirationDate,
          },
        };

        //generate AES key
        const secretPhrase = CryptoJS.lib.WordArray.random(16);
        const salt = CryptoJS.lib.WordArray.random(128 / 8);
        //aes key 128 bits (16 bytes) long
        const aesKey = CryptoJS.PBKDF2(secretPhrase.toString(), salt, {
          keySize: 128 / 32,
        });
        //initialization vector
        const iv = CryptoJS.enc.Utf8.parse(response.data.transactionId.slice(0, 16));
        const aesOptions = {
          mode: CryptoJS.mode.CBC,
          padding: CryptoJS.pad.Pkcs7,
          iv: iv,
        };
        const aesEncTrans = CryptoJS.AES.encrypt(
          JSON.stringify(transaction),
          aesKey,
          aesOptions
        );

        console.log(`Transaction: ${JSON.stringify(transaction)}`);
        console.log(
          "AES encrypted transaction [Base64]: " + aesEncTrans.toString()
        );
        console.log("AES key [hex]: " + aesEncTrans.key);
        console.log("AES init vector [hex]: " + aesEncTrans.iv);

        //encrypt AES key with RSA public key
        let rsaEncrypt = new JSEncrypt();
        rsaEncrypt.setPublicKey(response.data.rsaPublicKey);
        const rsaEncryptedAesKey = rsaEncrypt.encrypt(
          aesEncTrans.key.toString()
        );
        console.log("RSA encrypted AES key [base64]: " + rsaEncryptedAesKey);

        const encryptedTransaction = {
          transactionId: response.data.transactionId,
          payload: aesEncTrans.toString(),
          encAesKey: rsaEncryptedAesKey,
        };

        console.log(encryptedTransaction);

        let postRequest = {
          method: "post",
          url: "http://localhost:5000/api/transaction/process-payment",
          data: encryptedTransaction,
        };
        axios(postRequest).then((response2) => {
          console.log(response2);
        });
      })
      .catch((error) => {
        console.error(error);
      });
  };

  render() {
    return (
      <div>
        <hr />
        <button onClick={this.doTransaction}>HOLA</button>
      </div>
    );
  }
}

export default TransactionEncryption;
