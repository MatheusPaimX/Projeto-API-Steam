const express = require("express");
const axios = require("axios");
const path = require("path");

const app = express();

const API_KEY = "A7F39BCDC5235CEA1E4E2FC81A840611"; // Substitua pela sua API Key da Steam

// Configurar a pasta de views e o motor de templates EJS
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

// Pasta de arquivos estáticos (CSS, imagens)
app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: true }));

// Função para buscar os jogos do usuário
async function getSteamGames(steamId) {
    try {
        const url = `https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=${API_KEY}&steamid=${steamId}&include_appinfo=true&format=json`;
        const response = await axios.get(url);

        // Adicionando um log para verificar o status da resposta
        console.log("API Response:", response.data);

        if (response.data.response && response.data.response.games) {
            const games = await Promise.all(response.data.response.games.map(async (game) => {
                const gameDetailsUrl = `https://store.steampowered.com/api/appdetails?appids=${game.appid}&key=${API_KEY}`;
                const gameDetailsResponse = await axios.get(gameDetailsUrl);

                console.log("Game Details Response:", gameDetailsResponse.data); // Log para ver os detalhes do jogo

                let rating = "Neutra"; // Default value
                if (gameDetailsResponse.data[game.appid].success) {
                    const appData = gameDetailsResponse.data[game.appid].data;
                    if (appData.metacritic) {
                        if (appData.metacritic.score >= 80) {
                            rating = "Extremamente Positiva";
                        } else if (appData.metacritic.score >= 70) {
                            rating = "Muito Positiva";
                        } else if (appData.metacritic.score >= 50) {
                            rating = "Positiva";
                        } else {
                            rating = "Neutra";
                        }
                    } else if (appData.recommendations) {
                        if (appData.recommendations.total >= 80) {
                            rating = "Extremamente Positiva";
                        } else if (appData.recommendations.total >= 50) {
                            rating = "Muito Positiva";
                        }
                    }
                }
                return {
                    name: game.name,
                    imageUrl: `https://steamcdn-a.akamaihd.net/steam/apps/${game.appid}/header.jpg`,
                    steamRating: game.playtime_forever,
                    releaseDate: "2021-05-01", // Apenas um valor de exemplo
                    rating: rating
                };
            }));

            return { error: null, games: games };
        } else {
            console.error("Erro na resposta da API: Nenhum jogo encontrado ou perfil privado.");
            return { error: "Nenhum jogo encontrado ou perfil privado.", games: [] };
        }
    } catch (error) {
        console.error("Erro ao acessar a API da Steam para jogos:", error);
        return { error: "Erro ao acessar a API da Steam para jogos.", games: [] };
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
        case 'steam_rating':
            sortedGames.sort((a, b) => b.steamRating - a.steamRating);
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

    // Se houver algum erro em qualquer uma das chamadas, priorize-o
    const error = profileResult.error || gamesResult.error;
    res.render("index", { games: gamesResult.games, error: error, profile: profileResult.profile });
});

// Rota para ordenar os jogos
app.get("/sort-games", async (req, res) => {
    const steamId = req.query.steamId;
    const sortCriteria = req.query.sort;

    const gamesResult = await getSteamGames(steamId);
    const sortedGames = sortGames(gamesResult.games, sortCriteria);

    res.json(sortedGames);  // Retornar os jogos ordenados como JSON
});

// Iniciar o servidor
app.listen(3000, () => console.log("Servidor rodando em http://localhost:3000"));
