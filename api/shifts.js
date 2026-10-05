const {createVercelService}=require('../server/vercel-shifts.cjs');
const service=createVercelService();
module.exports=(req,res)=>service.handle(req,res);
