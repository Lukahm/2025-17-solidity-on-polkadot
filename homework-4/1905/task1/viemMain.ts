import { ABI, BYTECODE } from "./erc20"
import { createPublicClient, createWalletClient, defineChain, hexToBigInt, http, getContract } from "viem"
import { privateKeyToAccount } from "viem/accounts"
export const localChain = (url: string) => defineChain({
    id: 31337,
    name: 'Testnet',
    network: 'Testnet',
    nativeCurrency: {
        name: 'Doge',
        symbol: 'Dog',
        decimals: 18,
    },
    rpcUrls: {
        default: {
            http: [url],
        },
    },
    testnet: true,
})

function toViemAddress(address: string): string {
    return address.startsWith("0x") ? address : `0x${address}`
}



async function main() {
    const url = "http://127.0.0.1:8545"
    const publicClient = createPublicClient({ chain: localChain(url), transport: http() })
    const blockNumber = await publicClient.getBlockNumber()
    const privateKey = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
    const wallet = privateKeyToAccount(privateKey)
    const address = wallet.address
    const balance = await publicClient.getBalance({ address: address })
    const nonce = await publicClient.getTransactionCount({ address: address })

    const walletClient = createWalletClient({ account: wallet, chain: localChain(url), transport: http() })
    const txHash = await walletClient.sendTransaction({ to: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8", value: hexToBigInt('0x10000') })

    // deploy
    const contract = await walletClient.deployContract({
        abi: ABI,
        bytecode: BYTECODE,
        args: ["name", "symbol", 18, 123]
    })

    const receipt = await publicClient.waitForTransactionReceipt({ hash: contract })
    const contractAddress = receipt.contractAddress
    if (typeof contractAddress !== 'string' || !contractAddress.startsWith('0x')) {
        throw new Error(`Invalid contract address: ${contractAddress}`);
    }

    const totalSupply = await publicClient.readContract({ address: contractAddress, abi: ABI, functionName: "totalSupply", args: [] })

    const deployedContract = getContract({ address: contractAddress, abi: ABI, client: walletClient })
    const tx2 = await deployedContract.write.transfer(["0x70997970C51812dc3A010C7d01b50e0d17dc79C8", 10000])

    const erc20Balance = await publicClient.readContract({ address: contractAddress, abi: ABI, functionName: "balanceOf", args: ["0x70997970C51812dc3A010C7d01b50e0d17dc79C8"] })

    console.log(`result is ${erc20Balance}`)
    console.log(`Block number: ${blockNumber}, Address: ${address}, Balance: ${balance}, Nonce: ${nonce}, Total Supply: ${totalSupply}`)
    let unwatchBlock: (() => void) | null = null;
    let blockCount = 0;
    unwatchBlock = publicClient.watchBlockNumber({
        pollingInterval: 1000, // 每秒轮询一次，可根据需要调整
        onBlockNumber: (blockNumber) => {
            blockCount++;
            console.log(`监听到新区块: ${blockNumber}`);
            // 只监听前5个新区块，然后自动取消监听
            if (blockCount >= 5 && unwatchBlock) {
                unwatchBlock();
                unwatchBlock = null;
                console.log("已停止区块监听。");
            }
        },
        onError: (error) => {
            console.error(`区块监听出错: ${error}`);
            if (unwatchBlock) {
                unwatchBlock();
                unwatchBlock = null;
            }
        }
    });



}

main()