// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
// import "@openzeppelin/contracts@5.3.0/access/Ownable.sol";

contract KalshiLinkOracle is Ownable {

    string public name = "KalshiLinkOracle";

    struct DataPoint {
        address submitter;
        uint256 submitterTimestamp; // UNIX timestamp
        uint256 blockNumber;
        // uint256 marketName;
        uint256 value; // between 1 and 99_999 ( 3 decimal places )
        uint256 resolutionTimestamp; // UNIX timestamp
    }

    uint256 public nextIndexDataPoint = 0;

    mapping (uint256 => DataPoint) public dataEurUsd;

    constructor(address initialOwner) Ownable(initialOwner) {}

    function fulfillPredictionMarketDataEurUsd(uint256 _value, uint256 _timestamp, uint256 _resolutionTimestamp) external onlyOwner {
        // value is percentage value - 1 and 99_999 ( 3 decimal places )
        uint256 index = nextIndexDataPoint;
        dataEurUsd[index] = DataPoint({
            submitter: msg.sender,
            submitterTimestamp: _timestamp,
            blockNumber: block.number,
            value: _value,
            resolutionTimestamp: _resolutionTimestamp
        });
        nextIndexDataPoint++;
    }

    // View functions
    function getDataPoint(uint256 _index) public view returns (DataPoint memory) {
        DataPoint memory d = dataEurUsd[_index];
        return d;
    }

    function getName() public view returns (string memory) {
        return name;
    }
}
