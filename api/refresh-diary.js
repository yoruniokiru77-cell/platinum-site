const {createDiaryService}=require('../server/diary.cjs');
const service=createDiaryService();
module.exports=(req,res)=>service.cron(req,res);
