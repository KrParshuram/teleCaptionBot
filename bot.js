import { Telegraf } from "telegraf";
import userModel from "./src/model/user.js"
import connectDB from "./config/mongo.js"
import { message } from "telegraf/filters";
import eventModel from "./src/model/event.js"
// import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";


//creating a bot instance
const bot = new Telegraf(process.env.TEL_API);


//connecting to openAI API

//not using because my limit is exceeded
// const openai = new OpenAI({
//     apiKey: process.env['OPENAI_API_KEY'], // This is the default and can be omitted
// });

//connecting gemini api
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
// The Gemini 1.5 models are versatile and work with both text-only and multimodal prompts
const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL});



//connecting to DB using try catch for error handling
try {
    connectDB();
    console.log("database connected successfully")
} catch (error) {
    console.log(error);
    process.kill(process.pid , 'SIGTERM');
}



//handling /start command of user
bot.start(async (cntx) => {
    

    const from = cntx.update.message.from;
    
    console.log('from' , from);

    try {
        await userModel.findOneAndUpdate(
            { tgId: from.id },
            {
                $setOnInsert: {
                    firstName: from.first_name,
                    lastName: from.last_name,
                    isBot: from.is_bot,
                    username: from.username
                }
            },
            {
                upsert: true,
                new: true,
                setDefaultsOnInsert: true
            }
        );
    
        cntx.reply(`Hey ${from.first_name}, welcome to Awesome Bot.`);
    } catch (error) {
        console.log(error);
        cntx.reply("Facing difficulties... Please try again later.");
    }
    

    
})



//handling /generate command of user
bot.command('generate' , async (ctx) => {


    const from = ctx.update.message.from;

    const startOfDay = new Date();
    startOfDay.setHours(0,0,0,0);

    const endOfDay = new Date();
    endOfDay.setHours(23,59,59,999);

    //get events for the user 
    const events = await eventModel.find({
    tgId:from.id, 
    createdAt:{
        $gte: startOfDay,
        $lte: endOfDay,
    },

    });
    console.log('events' , events)
    
    // //make open ai api call using try catch 
    // try {
    //     const chatCompletion= openai.chat.completions.create(
    //         {
    //             messages:[
    //                 {
    //                     role:'system' ,
    //                     content:'act as a senior copywriter , you write highly engaging post for linkdln , facebook and twitter using provided thoughts/events throughout the day.'
    //                 },
    //                 {
    //                     role:'user' ,
    //                     content:`write like a human for human .craft three emgaging post tailored for linkedIn,Facebook and Twitter . Use simple language , use given time label just to 
    //                     understand the order of the event , do not mention time in posts . Each Post should creatively highlight the following events , Ensure the tone is conversational and impactful .Focus on respective platform's audience ,encouraging interaction , and driving interest in events :
    //                     ${events.map((event) => event.text).join(',')}
    //                     `
    //                 },
    //             ],

    //             model: process.env.OPENAI_MODEL,


    //         }
    //     );
    //     console.log('chatCompletion:' , chatCompletion);
    //     await ctx.reply("doing things...");
    // } catch (error) {
    //     console.log(error);
    //     await ctx.reply("something went wrong in post generation...");
    // }

    //using gemini instead of openai API
    try {
        const prompt = `act as a senior copywriter , you write highly engaging post for linkdln , facebook and twitter using provided thoughts/events throughout the day.
        write like a human for human .craft three emgaging post tailored for linkedIn,Facebook and Twitter . Use simple language , use given time label just to 
        understand the order of the event , do not mention time in posts . Each Post should creatively highlight the following events , Ensure the tone is conversational and impactful .Focus on respective platform's audience ,encouraging interaction , and driving interest in events :
        ${events.map((event) => event.text).join(',')}`
        
        //getting result for prompt
        const result = await model.generateContent(prompt);
        //sending result to user
        console.log(result);
        const response = await result.response;
        const text = response.text();
        // console.log(text);
        await ctx.reply(text);


        //doing increment in token used by user
        await userModel.findOneAndUpdate({
            tgId:from.id,
        }, {
            $inc:{
                promptTokens:response.usageMetadata.promptTokenCount ,
                completionTokens:response.usageMetadata.completionTokens ,                         
            }
        })

    } catch (error) {
        console.log(error);
        await ctx.reply("getting problem while generating content");
    }



    //handling if no message are in events
    if(events === 0){
        await ctx.reply("no events for now");
        return;
    }

    
})



bot.command('chodu' , async(abc) => {
    const from = abc.update.message.from;
    console.log('from' ,abc.update.message.from)
    abc.reply(`Chodu ${from.first_name} padh le be chodu`);
})




bot.on(message('text') , async (ctx) => {
    const from = ctx.update.message.from;
    const message = ctx.update.message.text;

    try {
        await eventModel.create({
            text:message,
            tgId:from.id,
        })

        ctx.reply("Got the message")
    } catch (error) {
        console.log(error);
        ctx.reply("facing problem , try again later")
    }
})







bot.launch()


// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))



