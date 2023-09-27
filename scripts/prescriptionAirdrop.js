const perscriptionAirdrop = async (prescOwnerAddress, inscTxId, inscPKWIF, fundingPKWIF) => {
  const inscTx = await getTx(inscTxId);

  const inscVout = 0
  const inscUTXO = {
    txId: inscTxId,
    script: inscTx.vout[inscVout].scriptPubKey.hex,
    outputIndex: inscVout,
    satoshis: inscTx.vout[inscVout].value*10^8 // change to sats
  }

  const fundingPriv = bsv.PrivateKey.fromWIF(fundingPKWIF)
  const fundingAddress = fundingPriv.toPublicKey().toAddress().toString()

  const utxos = await getUTXOs(fundingAddress)
  const utxoScript = await getTx(utxos[0].tx_hash)
  const utxoValue = utxos[0].value

  const fundingUTXO = {
    txId: utxos[0].tx_hash,
    script: utxoScript.vout[0].scriptPubKey.hex,
    outputIndex: utxos[0].tx_pos,
    satoshis: utxoValue
  }

  let bsvtx = bsv.Transaction()
    .from([inscUTXO, fundingUTXO]) // add utxos as inputs to new tx
    // send inscription to prescription owner
    .to(prescOwnerAddress, 1)
    // send change back to funding address
    .to(fundingAddress, utxoValue-5) // spend 5 sats on the tx
    // sign first input (inscription)
    .sign(bsv.PrivateKey.fromWIF(inscPKWIF))
    // sign second input (inscription)
    .sign(fundingPriv);

  const txHex = bsvtx.toString();

  return txHex // return txhex before broadcasting until fully tested

  console.log(txHex);
  let res = broadcast(txHex);
  console.log(res);
  return res
}


async function getUTXOs(address) {
  const response = await fetch("https://api.whatsonchain.com/v1/bsv/main/address/" + address + "/unspent");
  const data = await response.json();
  return data;
}

async function getTx(txid) {
  const response = await fetch("https://api.whatsonchain.com/v1/bsv/main/tx/hash/" + txid);
  const data = await response.json();
  return data;
}

const broadcast = async txhex => {
  const r = await (await fetch(`https://api.whatsonchain.com/v1/bsv/main/tx/raw`, {
    method: 'post',
    body: JSON.stringify({ txhex })
  })).json();
  return r;
}

const prescAPIEndpoint = "https://staging-backend.relayx.com/api/market/7d1d0d1580f41468b0dcee90dc218059f0e171fd71d5b3590f4ac20a3fd4fe06_o2/items"
const getPerscriptionList = async () => {
  try {
    const response = await fetch(prescAPIEndpoint);
    const perscData = await response.json();
    console.log(perscData);
    const unorderedPerscList = perscData.data.items.map(item => ({
      propsNo: item.props.no,
      txid: item.txid,
      location: item.location,
      origin: item.origin,
      ...(item.seller && { seller: item.seller })
    }));
    const perscListWithoutOwners = unorderedPerscList.sort((a, b) => a.propsNo - b.propsNo);
    console.log(perscListWithoutOwners);

    const perscList = await addOwnerAddress(perscListWithoutOwners);
    return perscList

  } catch (error) {
    console.error('Error fetching data:', error);
  }
}


async function fetchOwnerInfo(location) {
  const response = await fetch(prescAPIEndpoint + "/" + location);
  const data = await response.json();
  return data;
}

async function addOwnerAddress(array) {
  const promises = array.map(async (item, index) => {
    return new Promise(async (resolve) => {
      setTimeout(async () => {
        const res = await fetchOwnerInfo(item.location);
        resolve({
          ...item,
          ownerAddress: res.data.item.owner,
          paymail: res.data.item.paymail,
        });
      }, index * 150);  // 150ms delay between each request
    });
  });

  return await Promise.all(promises);
}

const getItemsTxedAfterCutoff = async (blockHeight, perscList) => {
  const chunkSize = 20; // woc api max query size
  const results = [];

  for (let i = 0; i < perscList.length; i += chunkSize) {
    // console.log("calling woc api to check for txs after snapshot - at iteration " + i);
    const chunk = perscList.slice(i, i + chunkSize);
    const txids = chunk.map(item => item.txid);

    try {
      const response = await fetch('https://api.whatsonchain.com/v1/bsv/main/txs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ txids: txids }),
      });
      const data = await response.json();

      const filteredData = data.filter(item => item.blockheight >= blockHeight);
      results.push(...filteredData);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  }

  return results;
}

async function readFile() {
  const fileInput = document.getElementById('fileInput');
  const file = fileInput.files[0];

  if (file) {
    try {
      const fileContent = await readAsJSON(file);
      console.log("File content as JSON:", fileContent);
      return fileContent;
    } catch (error) {
      console.error("Error reading file:", error);
    }
  } else {
    console.log("No file selected.");
  }
}

function readAsJSON(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = function(event) {
      try {
        const json = JSON.parse(event.target.result);
        resolve(json);
      } catch (e) {
        reject("Could not parse JSON");
      }
    };

    reader.onerror = function() {
      reject("Could not read file");
    };

    reader.readAsText(file);
  });
}
