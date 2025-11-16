// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
// import { ERC20PresetMinterPauser } from "@openzeppelin/contracts/token/ERC20/ERC20PresetMinterPauser.sol";
// import "@openzeppelin/contracts/token/ERC20/presets/ERC20PresetMinterPauser.sol";
// import "@openzeppelin/contracts/token/ERC20/ERC20Burnable.sol";
import { MockERC20 } from "./MockERC20.sol";
// import "@openzeppelin/contracts/access/Ownable.sol";
// import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
// import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
// import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

contract TreasuryManager /*is Ownable*/ {
    MockERC20 public usdcToken;
    MockERC20 public eurcToken;
    MockERC20 public pstToken;

    // address deadAddress = 0x000000000000000000000000000000000000dEaD;

    event Deposit(address, uint256, uint256);
    event Withdraw(address, uint256, uint256);
    event Log(uint256);
    event NewRatioCalculated(uint256);

    uint256 public usdToEurProportion = 50 * 10**18; // 10**6
    uint256 public eurToUsdProportion = 50 * 10**18; // 10**6

    // uint256 public usdToEurProportion = 25 * 10**18;
    // uint256 public eurToUsdProportion = 75 * 10**18;

    constructor(address _usdcTokenAddr, address _eurcTokenAddr, address _pstTokenAddr) {
        usdcToken = MockERC20(_usdcTokenAddr);
        eurcToken = MockERC20(_eurcTokenAddr);
        pstToken = MockERC20(_pstTokenAddr);
    }

    function depositDualAll() external {
        address sender = msg.sender;
        // uint256 ratioRequired = eurToUsdProportion / usdToEurProportion;
        // uint256 amount = 1 ether;

        // address sender = msg.sender;
        uint256 totalDeposit = 2 * 1e18;  // Fixed total value (adjust if rate != 1:1)
        uint256 usdAmount = (totalDeposit * usdToEurProportion) / (100 * 1e18); // 0.5 Ether
        uint256 eurAmount = (totalDeposit * eurToUsdProportion) / (100 * 1e18); // 0.5 Ether

        uint256 amountUsdc = usdAmount; //usdcToken.balanceOf(sender);
        uint256 amountEurc = eurAmount; //eurcToken.balanceOf(sender);

        // uint256 ratioActual = amountEurc / amountUsdc;
        // require(ratioRequired == ratioActual, "Real ratio is different than required ratio");
        // uint256 amount = 1 ether;

        if (pstToken.totalSupply() == 0) {
            pstToken.mint(sender, 1 ether);
        } else {
            uint256 tvlCur = usdcToken.balanceOf(address(this)) + eurcToken.balanceOf(address(this));
            uint256 tvlNew = tvlCur + amountUsdc + amountEurc;
            // uint256 newRatio = (tvlCur * 1 ether) / tvlNew;
            uint256 newRatio = (tvlNew * 1 ether) / tvlCur;
            // uint256 amountPst = pstToken.totalSupply() * (1_000000000_000000000 - newRatio);
            uint256 amountPst = (pstToken.totalSupply() * (newRatio - 1_000000000_000000000)) / 1_000000000_000000000;
            emit Log(pstToken.totalSupply());
            emit Log(1_000000000_000000000);
            emit Log(newRatio);

            pstToken.mint(sender, amountPst);
            emit NewRatioCalculated(newRatio);
        }

        require(usdcToken.transferFrom(sender, address(this), amountUsdc) && eurcToken.transferFrom(sender, address(this), amountEurc), "USDC/EURC transfer failed");

        emit Deposit(msg.sender, amountUsdc, amountEurc);
    }

    function withdrawAndBurn(uint256 amount) external {
        // uint256 amount = 1 ether;
        require(pstToken.balanceOf(msg.sender) >= amount, "Insufficient PST");
        uint256 totalSupply = pstToken.totalSupply();
        require(totalSupply > 0, "No PST supply");
        uint256 share = (amount * 1 ether) / totalSupply;
        uint256 usdBalance = usdcToken.balanceOf(address(this));
        uint256 eurBalance = eurcToken.balanceOf(address(this));
        uint256 usdToReturn = (share * usdBalance) / 1 ether;
        uint256 eurToReturn = (share * eurBalance) / 1 ether;
        pstToken.burnFrom(msg.sender, amount);  // Alice must approve the spent of PST 1st
        usdcToken.transfer(msg.sender, usdToReturn);
        eurcToken.transfer(msg.sender, eurToReturn);
        emit Withdraw(msg.sender, usdToReturn, eurToReturn);
    }

    function reBalance(uint256 _targetUsdPerc /*25*/ /*, uint256 targetEurPerc 75*/) external {
        uint256 totalValue = usdcToken.balanceOf(address(this)) + eurcToken.balanceOf(address(this));

        uint256 targetUsd = (_targetUsdPerc         * totalValue * 1 ether) / (100 * 1 ether);
        uint256 targetEur = ((100 - _targetUsdPerc) * totalValue * 1 ether) / (100 * 1 ether);

        uint256 amountEur = eurcToken.balanceOf(address(this)) > targetEur ? 0 : targetEur - eurcToken.balanceOf(address(this));
        eurcToken.mint(address(this), amountEur); // mint

        uint256 amountUsd = usdcToken.balanceOf(address(this)) > targetUsd ? usdcToken.balanceOf(address(this)) - targetUsd : 0;
        // usdcToken.approve(address(this), amountUsd); // burn step one
        // usdcToken.transferFrom(address(this), deadAddress, amountUsd); // burn step two
        usdcToken.burn(amountUsd); // burn

        usdToEurProportion = _targetUsdPerc * 10**18;
        eurToUsdProportion = (100 - _targetUsdPerc) * 10**18;
    }

    // VIEW ONLY FUNCTIONS
    function balOfUsdc(/*address _a*/) public view returns (uint256) {
        return usdcToken.balanceOf(address(this));
    }

    function balOfEurc(/*address _a*/) public view returns (uint256) {
        return eurcToken.balanceOf(address(this));
    }

    function balOfUsdcSender(/*address _a*/) public view returns (uint256) {
        return usdcToken.balanceOf(msg.sender);
    }

    function balOfEurcSender(/*address _a*/) public view returns (uint256) {
        return eurcToken.balanceOf(msg.sender);
    }

}