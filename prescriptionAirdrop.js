const perscriptionAirdrop = (prescOwnerAddress, inscUTXO, inscPKWIF, fundingUTXO, fundingPKWIF) => {
  let bsvtx = bsv.Transaction();

  bsvtx.from([inscUTXO, fundingUTXO]) // add utxos as inputs to new tx
    // send inscription to prescription owner
    .to(prescOwnerAddress, 1)
    // send change back to funding address
    .change(bsv.PublicKey.fromPrivateKey(bsv.PrivateKey.fromWIF(fundingPKWIF)))
    // sign first input (inscription)
    .sign(bsv.PrivateKey.fromWIF(inscPKWIF))
    // sign second input (inscription)
    .sign(bsv.PrivateKey.fromWIF(fundingPKWIF));


  const txHex = bsvtx.toString();

  return txHex // return txhex before broadcasting until fully tested
  
  console.log(txHex);
  let res = broadcast(txHex);
  console.log(res);
  return res
}


const broadcast = async txhex => {
  const r = await (await fetch(`https://api.whatsonchain.com/v1/bsv/main/tx/raw`, {
      method: 'post',
      body: JSON.stringify({ txhex })
  })).json();
  return r;
}