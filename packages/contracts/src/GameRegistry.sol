// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title GameRegistry
 * @dev Contract for storing IPFS hashes of generated games on-chain
 */
contract GameRegistry is Ownable {
    struct Game {
        string ipfsCid;
        address creator;
        uint256 createdAt;
        string name;
        string gameType;
    }

    // Mapping from game ID to game data
    mapping(uint256 => Game) public games;

    // Total number of games registered
    uint256 public totalGames;

    // Events
    event GameRegistered(
        uint256 indexed gameId,
        address indexed creator,
        string ipfsCid,
        string name,
        string gameType,
        uint256 timestamp
    );

    event GameUpdated(
        uint256 indexed gameId,
        string newIpfsCid,
        uint256 timestamp
    );

    constructor() Ownable(msg.sender) {}

    /**
     * @dev Register a new game with its IPFS CID
     * @param _ipfsCid The IPFS content identifier
     * @param _name The game name
     * @param _gameType The type of game (platformer, puzzle, shooter, etc.)
     */
    function registerGame(
        string calldata _ipfsCid,
        string calldata _name,
        string calldata _gameType
    ) external returns (uint256) {
        require(bytes(_ipfsCid).length > 0, "IPFS CID is required");
        require(bytes(_name).length > 0, "Game name is required");

        uint256 gameId = totalGames++;
        games[gameId] = Game({
            ipfsCid: _ipfsCid,
            creator: msg.sender,
            createdAt: block.timestamp,
            name: _name,
            gameType: _gameType
        });

        emit GameRegistered(
            gameId,
            msg.sender,
            _ipfsCid,
            _name,
            _gameType,
            block.timestamp
        );

        return gameId;
    }

    /**
     * @dev Update the IPFS CID for an existing game
     * @param _gameId The ID of the game to update
     * @param _newIpfsCid The new IPFS content identifier
     */
    function updateGame(uint256 _gameId, string calldata _newIpfsCid) external {
        require(_gameId < totalGames, "Game does not exist");
        require(msg.sender == games[_gameId].creator, "Only creator can update");

        games[_gameId].ipfsCid = _newIpfsCid;

        emit GameUpdated(_gameId, _newIpfsCid, block.timestamp);
    }

    /**
     * @dev Get game details by ID
     * @param _gameId The ID of the game
     */
    function getGame(uint256 _gameId) external view returns (
        string memory ipfsCid,
        address creator,
        uint256 createdAt,
        string memory name,
        string memory gameType
    ) {
        require(_gameId < totalGames, "Game does not exist");
        Game memory game = games[_gameId];
        return (
            game.ipfsCid,
            game.creator,
            game.createdAt,
            game.name,
            game.gameType
        );
    }

    /**
     * @dev Get games by creator address
     * @param _creator The creator's wallet address
     * @return gameIds Array of game IDs created by the creator
     */
    function getGamesByCreator(address _creator) external view returns (uint256[] memory gameIds) {
        uint256 count = 0;
        for (uint256 i = 0; i < totalGames; i++) {
            if (games[i].creator == _creator) {
                count++;
            }
        }

        gameIds = new uint256[](count);
        uint256 index = 0;
        for (uint256 i = 0; i < totalGames; i++) {
            if (games[i].creator == _creator) {
                gameIds[index++] = i;
            }
        }
    }
}
