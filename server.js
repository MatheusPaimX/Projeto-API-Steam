const express = require("express");
const axios = require("axios");
const path = require("path");

const app = express();

const API_KEY = "A7F39BCDC5235CEA1E4E2FC81A840611"; // Substitua pela sua API Key da Steam

app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: true }));

// Função para buscar os jogos do usuário
async function getSteamGames(steamId) {
    try {
        const url = `https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=${API_KEY}&steamid=${steamId}&include_appinfo=true&format=json`;
        const response = await axios.get(url);

        if (!response.data.response?.games) {
            return { error: "Nenhum jogo encontrado ou perfil privado.", games: [] };
        }

        const games = await Promise.all(response.data.response.games.map(async (game) => {
            const gameDetailsUrl = `https://store.steampowered.com/api/appdetails?appids=${game.appid}`;
            let releaseDate = "Data desconhecida";
            try {
                const gameDetailsResponse = await axios.get(gameDetailsUrl);
                if (gameDetailsResponse.data[game.appid] && gameDetailsResponse.data[game.appid].success) {
                    const appData = gameDetailsResponse.data[game.appid].data;
                    if (appData.release_date && appData.release_date.date) {
                        releaseDate = appData.release_date.date;
                    }
                }
            } catch (err) {
                // Se falhar ao buscar detalhes, mantém a data como "Data desconhecida"
            }
            return {
                name: game.name,
                imageUrl: `https://steamcdn-a.akamaihd.net/steam/apps/${game.appid}/header.jpg`,
                // Removida a referência à nota Steam
                releaseDate: releaseDate,
                appId: game.appid
            };
        }));

        return { error: null, games: games };
    } catch (error) {
        console.error("Erro ao acessar a API da Steam.", error.message);
        return { error: "Erro ao acessar a API da Steam.", games: [] };
    }
}

// Função para buscar os dados do perfil do usuário
async function getUserProfile(steamId) {
    try {
        const url = `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${API_KEY}&steamids=${steamId}`;
        const response = await axios.get(url);
        if (response.data.response.players && response.data.response.players.length > 0) {
            const player = response.data.response.players[0];
            return { error: null, profile: { name: player.personaname, avatar: player.avatarfull, steamId: player.steamid } };
        } else {
            return { error: "Usuário não encontrado.", profile: null };
        }
    } catch (error) {
        return { error: "Erro ao acessar a API da Steam para o perfil.", profile: null };
    }
}

// Função para ordenar os jogos com base no critério selecionado
function sortGames(games, sortCriteria) {
    let sortedGames = [...games];
    switch (sortCriteria) {
        case 'name_asc':
            sortedGames.sort((a, b) => a.name.localeCompare(b.name));
            break;
        case 'name_desc':
            sortedGames.sort((a, b) => b.name.localeCompare(a.name));
            break;
        case 'release_date_new':
            sortedGames.sort((a, b) => new Date(b.releaseDate) - new Date(a.releaseDate));
            break;
        case 'release_date_old':
            sortedGames.sort((a, b) => new Date(a.releaseDate) - new Date(b.releaseDate));
            break;
        default:
            break;
    }
    return sortedGames;
}

// Rota principal (GET)
app.get("/", (req, res) => {
    res.render("index", { games: [], error: null, profile: null });
});

// Rota para processar o formulário (POST)
app.post("/", async (req, res) => {
    const steamId = req.body.steam_id;
    const profileResult = await getUserProfile(steamId);
    const gamesResult = await getSteamGames(steamId);
    const error = profileResult.error || gamesResult.error;
    res.render("index", { games: gamesResult.games, error: error, profile: profileResult.profile });
});

// Rota para ordenar os jogos
app.get("/sort-games", async (req, res) => {
    const steamId = req.query.steamId;
    const sortCriteria = req.query.sort;
    const gamesResult = await getSteamGames(steamId);
    const sortedGames = sortGames(gamesResult.games, sortCriteria);
    res.json(sortedGames);
});

app.listen(3000, () => console.log("Servidor rodando em http://localhost:3000"));


// aaa