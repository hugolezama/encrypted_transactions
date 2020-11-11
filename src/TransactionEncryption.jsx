import React, { Component } from "react";
import CryptoJS from "crypto-js";
import JSEncrypt from "jsencrypt";
import axios from "axios";

class TransactionEncryption extends Component {
  constructor() {
    super();
    this.state = {
      type: "PAYMENT",
      amount: 10000000,
      number: "4242424242424242",
      cvv: "123",
      expirationDate: "0822",
      rsaPublicKey: null,
      transactionId: null,
      transaction: null,
    };
  }

  getPublicKey = () => {
    let request = {
      method: "get",
      url: "http://localhost:5000/api/transaction/public-key",
    };
    axios(request)
      .then((response) => {
        console.log("RSA public key[base64]: " + response.data.rsaPublicKey);
        this.setState({
          rsaPublicKey: response.data.rsaPublicKey,
          transactionId: response.data.transactionId,
        });
      })
      .catch((error) => {
        console.error(error);
      });
  };

  resetValues = () => {
    this.setState({
      rsaPublicKey: null,
      transactionId: null,
      transaction: null
    });
  };
  executeTransaction = () => {
    let transaction = {
      transactionId: this.state.transactionId,
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
    const iv = CryptoJS.enc.Utf8.parse(this.state.transactionId.slice(0, 16));
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
    rsaEncrypt.setPublicKey(this.state.rsaPublicKey);
    const rsaEncryptedAesKey = rsaEncrypt.encrypt(aesEncTrans.key.toString());
    console.log("RSA encrypted AES key [base64]: " + rsaEncryptedAesKey);

    const encryptedTransaction = {
      transactionId: this.state.transactionId,
      payload: aesEncTrans.toString(),
      encAesKey: rsaEncryptedAesKey,
    };

    console.log(encryptedTransaction);

    let postRequest = {
      method: "post",
      url: "http://localhost:5000/api/transaction/process-payment",
      data: encryptedTransaction,
    };
    axios(postRequest).then((response) => {
      console.log(response);
      this.setState({
        transaction: JSON.stringify(response.data, null, 2),
        rsaPublicKey: null,
      transactionId: null,
      });
      
    });
  };

  render() {
    return (
      <div>
        <hr />
        <button onClick={this.getPublicKey}>GET PUBLIC KEY</button>

        <button
          onClick={this.executeTransaction}
          disabled={!this.state.rsaPublicKey}
        >
          EXECUTE TRANSACTION
        </button>
        <button onClick={this.resetValues}>RESET</button>

        {this.state.transaction && <div><pre>{this.state.transaction}</pre></div>}
      </div>
    );
  }
}

export default TransactionEncryption;
