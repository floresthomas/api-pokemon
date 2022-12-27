const { Router } = require('express');
const axios = require("axios");
const {Pokemon, Types} = require ("../db");
const { json } = require('body-parser');
// Importar todos los routers;
// Ejemplo: const authRouter = require('./auth.js');
const router = Router();


// Configurar los routers
// Ejemplo: router.use('/auth', authRouter);

//Variante del map, el map te trae etiquetas html, sin embargo esta forma no trae etiquetas html
//Funcion para que espere a que termine el recorrido
const asyncForEach = async (array, callback) => {
    for (let index = 0; index < array.length; index++) {
        //Espero a que se ejecute el callback
        await callback(array[index], index, array);
    }
};

let aux = [];

router.get("/pokemons", async (req,res) => {
    const { name } = req?.query;
    try {
        if(aux.length === 0){
        const requestPokemons = await axios.get("https://pokeapi.co/api/v2/pokemon?limit=40")
        await asyncForEach(requestPokemons.data.results, async (pokemon) => {
            let url = pokemon.url;
            const pokemonUrl = await axios.get(url);

            let sprites = pokemonUrl.data.sprites.other;

            let imagen;
            let imagen2;
            for (const sprite in sprites) {
                if(sprite === 'official-artwork'){
                    imagen = sprites["official-artwork"].front_default;
                }
                if (sprite === 'dream_world') {
                    imagen2 = sprites.dream_world.front_default;
                }
                }

                const object = {
                    id: pokemonUrl.data.id,
                    name: pokemonUrl.data.name,
                    life: pokemonUrl.data.stats[0].base_stat,
                    attack: pokemonUrl.data.stats[1].base_stat,
                    defending: pokemonUrl.data.stats[2].base_stat,
                    speed: pokemonUrl.data.stats[5].base_stat,
                    height: pokemonUrl.data.height,
                    weight: pokemonUrl.data.weight,
                    image: imagen,
                    image2: imagen2,
                    type: pokemonUrl.data.types.map((element) => element.type.name),
                };
                aux.push(object)
                return aux;
            });
        }
        const db = await Pokemon.findAll({ include: [{ model: Types}] });

        let dbAndApi = [...aux, ...db];
// Aca va el name
        if(name){
            let pokemonValue = dbAndApi.filter((element) => {
                    return element.name.includes(name)
            });

            if(pokemonValue.length > 0){
                return res.status(201).json({
                    success: true,
                    data: pokemonValue
                })
            }else {
                return res.status(400).json({ msg: "No se encontro el pokemon"})
            }
            
        } else {
            res.status(201).json({
                success: true,
                data: dbAndApi
            })
        }

    } catch (error) {
        res.status(400).json({
            success: false,
            err: error.message
        });
    }
})

router.get("/pokemons/:id", async (req,res) => {
    const { id } = req.params;

    if(!id) res.status(400).send("No existe el id");
    try {
        if(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
            const pokemonDb = await Pokemon.findByPk(id, {
                include: [{ model: Types }],
            });
            return res.status(201).json({
                success:true,
                data: pokemonDb,
            });
        } else{

        const pokemonId = await axios.get(
            `https://pokeapi.co/api/v2/pokemon/${id}`
        );

        let sprites = pokemonId.data.sprites.other;

        let imagen;
        let imagen2;
        for (const sprite in sprites) {
            if(sprite === "official-artwork"){
                imagen = sprites["official-artwork".front_default]
            }
            if(sprite === "dream_world"){
                imagen2 = sprites.dream_world.front_default;
            }
        }

        const obj = {
            id: pokemonId.data.id,
            name: pokemonId.data.name,
            life: pokemonId.data.stats[0].base_stat,
            attack: pokemonId.data.stats[1].base_stat,
            defending: pokemonId.data.stats[2].base_stat,
            speed: pokemonId.data.stats[5].base_stat,
            height: pokemonId.data.height,
            weight: pokemonId.data.weight,
            image: imagen,
            image2: imagen2,
            types: pokemonId.data.types.map((element) => element.type.name)
        };
        return res.status(201).json({
            success: true,
            data: obj
        });
        }
    }
    catch (error) {
        res.status(400).json({
            success: false,
            err: error.message
        });
    }
});

router.post("/pokemons", async (req,res) => {
    const { name, life, attack, defending, speed, height, weight, image, types, createdInDb} = req.body
    if(!name){
        res.status(400).send("Completly name")
    }

    let pokemonExistente = await Pokemon.findOne({
        where: {
            name: name
        }
    })

    if(pokemonExistente) return res.status(404).send("Ya existe ese pokemon")

    try {
    const pokemonCreated = await Pokemon.create({
        name, 
        life, 
        attack, 
        defending, 
        speed, 
        height, 
        weight, 
        image,
        createdInDb
      })

      const pokeType = await Types.findAll({
        where: { name: types }
      })
      
      pokemonCreated.addType(pokeType)
      return res.status(201).json({
        success: true,
        msg: "Pokemon creado con exito"
      });
    }catch (error) {
        res.status(400).json({
            success: false,
            err: error.message
        })
    }
      
})

router.get("/types", async (req,res) => {
    try 
    {
        //En una variable me guardo el findAll que le hago a mi modelo types
        //El findAll pregunta si hay datos y si hay datos los devuelve
        const typesList = await Types.findAll();
        
        //Si no hay nada en la variable typesList entra al if
        if (typesList.length === 0) {
            // aca cargo por primera vez Types de la api a la DB
            try{
                //Guardo la informacion de la url dentro de la variable response
                const response = await axios.get("https://pokeapi.co/api/v2/type");
                //A la variable anterior la cual tiene la informacion de la url le hago un map
                //para que me retorne lo que yo quiero que es el name del type y eso me lo guardo en
                //typesList
                const typesList = response.data.results.map((t) => {
                                            return { name: t.name }
                                            });
                //A mi modelo types le hago un bulkcreate y le paso mi variable la cual tiene todos los tipos y me los va a crear cada vez
                //que haga npm start
                await Types.bulkCreate(typesList);
                return res.status(201).json(typesList);
            }
            catch(error){
                res.status(400).json({
                    success:false,
                    err: error.message
                });    
            }
        }
        else {
            return res.status(200).json(typesList); /// return types
        }
    } 
    catch (error)
    {
        res.status(400).json({
            success:false,
            err: error.message
        })
    }
  })
module.exports = router;