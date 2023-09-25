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

const prescAPIEndpoint = "https://staging-backend.relayx.com/api/market/7d1d0d1580f41468b0dcee90dc218059f0e171fd71d5b3590f4ac20a3fd4fe06_o2/items"
const getPerscriptionList = async () => {
  try {
    const response = await fetch(prescAPIEndpoint);
    const perscData = await response.json();
    // console.log(perscData);
    const unorderedPerscList = perscData.data.items.map(item => ({
      propsNo: item.props.no,
      txid: item.txid,
      location: item.location
    }));
    // console.log(unorderedPerscList);
    const perscListWithoutOwners = unorderedPerscList.sort((a, b) => a.propsNo - b.propsNo);
    // console.log(perscList);

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
  const promises = array.map(async item => {
    const res = await fetchOwnerInfo(item.location);
    return {
      ...item,
      ownerAddress: res.data.item.owner,
      paymail: res.data.item.paymail,
    };
  });

  const enrichedArray = await Promise.all(promises);
  return enrichedArray;
}

const getItemsTxedAfterCutoff = async (blockHeight, perscList) => {
  const chunkSize = 20; // woc api max query size
  const results = [];

  for (let i = 0; i < perscList.length; i += chunkSize) {
    console.log("calling woc api to check for txs after snapshot - at iteration " + i);
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
