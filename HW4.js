'use strict';
require('dotenv').config();
const MongoClient=require('mongodb').MongoClient;
const assert=require('assert');
const jwt=require('jsonwebtoken');
const express=require('express');
const multer=require('multer');
const os=require('os');
const gridfsStorage=require('multer-gridfs-storage');
const grid=require('gridfs-stream');
const app=express();
const router=express.Router();
const bcrypt=require('bcrypt');
const saltrounds=10;
const formdata=require('express-form-data');
const jwtcode=process.env.JWT_CODE;
var storage = multer.memoryStorage();
var upload = multer({ storage: storage });
var username=null;
var password=null;
var revNum=0;
const options = {
    uploadDir: os.tmpdir(),
    autoClean: true
  };
app.use(express.json());
async function checkusername(username,password){
    try{
    var client=await MongoClient.connect(process.env.DBURI);
    var db=client.db(process.env.DB_USERNAME);
    var collection=db.collection('userinfo');
    var users=await collection.find({'username':username}).toArray();
    const match=await bcrypt.compare(password,users[0].password);
    client.close();
    if(match){
        return true;
    }
    else {
        return false;
    }
    }
    catch(err){
        console.log(err);
    }
}


function jwtverify(token){
 return jwt.verify(token,process.env.JWT_CODE,function(err,decoded){
        if(err){
            return 'err';
        }
        else{
            return decoded;
        }
    });
}
function encrypt(password){
bcrypt.genSalt(saltrounds,function(err,salt){
    bcrypt.hash(password,salt,function(err,hash){
        return hash;               
    });
});
}

app.get('/',(req,res)=>{
    res.send('Welcome to Zeeshan\'s AWS');
});

app.post('/login',(req,res,next)=>{
    username=req.body.username;
    password=req.body.password;
    var flag=false;
  //  console.log(username);
   // console.log(password);
    checkusername(username,password).then(function(val,err){
        if(err){return next(err);}
        if(val){
            res.send(jwt.sign({
                 name:username
            },jwtcode,{expiresIn:'3h'}));
            flag=true;
            if(flag){console.log('Login successful');}else{console.log('Login unsuccessful');}
            return ;
        }else{
            res.send('Wrong username/password');
            return;
        }
    });
});
//app.use(multer);
// app.use(formdata.parse(options));
// app.use(formdata.format());
// // change the file objects to fs.ReadStream 
// app.use(formdata.stream());
// // union the body and the files
// app.use(formdata.union());
app.post('/upload',upload.single('file'),(req,res)=>{
    //var token=req.body.token;
    var token=jwtverify(req.headers.token);
    if(token=='err'){
        res.send("Error in token/token expired");
    }
    else if(token==undefined){
        res.send("Token not included");
    }else{
    console.log(token.name);
    async function run(){
        var client=await MongoClient.connect(process.env.DBURI);
    var db=client.db(process.env.DB_USERNAME);
    var collection_user=db.collection('userinfo');
    var collection_files=db.collection('files');
    var collection_version=db.collection('versions');
    var users=await collection_user.find({'username':token.name}).toArray();
    if(users.length<1){
        client.close();
        res.send("Not Authorized/Please login");
        return;
    }
    else{
        var topicName=req.body.name;
        revNum=1;
        var desc=req.body.desc;// console.log(users.length);
        var file=req.file;//console.log(file);
        var filename=file.originalname;
        var filepath=`http://localhost:8080/list/${topicName}/${filename}/${revNum}/`;
        var fileData=file.buffer;
        var filetype=file.mimetype;
        var owner=users[0]._id;//console.log(file);
        collection_files.insertOne({
            "timestamp":Date(),
            "title":topicName
        }).then();
        var files=await collection_files.find({"title":topicName}).toArray();
        console.log(files);
         collection_version.insertOne({
            "desc":desc,
            "document":fileData,
            "date":Date(),
            "filetype":filetype,
            "filename":filename,
            "downloadUri":filepath,
            "file_id":files[0]._id,
            "revNum":revNum,
            "createdby":owner 
        });
        client.close();
        res.sendStatus(200);
        return;
    }
    }
    run();}
});
app.post('/upload/:topicname',upload.single('file'),(req,res)=>{
    var token=jwtverify(req.headers.token);
    var temptopicname=req.params.topicname; console.log(temptopicname);
    if(token=='err'){ res.send("Error in token/token expired");}
    else if(token==undefined){res.send("Token not included");}
    else{//console.log(token.name);
    async function run(){
    var client=await MongoClient.connect(process.env.DBURI);
    var db=client.db(process.env.DB_USERNAME);
    var collection_user=db.collection('userinfo');
    var collection_files=db.collection('files');
    var collection_version=db.collection('versions');
    var users=await collection_user.find({'username':token.name}).toArray();
    if(users.length<1){
        client.close();
        res.send("Not Authorized/Please login");
        return;
    }
    else{
        var topicName=req.body.name;
        var tempcolfile=await collection_files.find({"title":temptopicname}).toArray(); console.log(tempcolfile.length);
        var tempcolver=await collection_version.find({"file_id":tempcolfile[0]._id}).toArray();
        revNum=tempcolver[tempcolver.length-1].revNum+1;
        var desc=req.body.desc;
        console.log(users.length);
        var file=req.file;
        var filename=file.originalname;
        var filepath=`http://localhost:8080/list/${topicName}/${filename}/${revNum}/`;
        var fileData=file.buffer;
        var filetype=file.mimetype;
        var owner=users[0]._id;
         collection_version.insertOne({
            "desc":desc,
            "document":fileData,
            "date":Date(),
            "filetype":filetype,
            "filename":filename,
            "downloadUri":filepath,
            "file_id":tempcolfile[0]._id,
            "revNum":revNum,
            "createdby":owner 
        });
        client.close();
        res.sendStatus(200);
        return;
    }}run();}
});
app.use(express.json());
app.patch('/edit/:topicname/:revNum/:filename',(req,res)=>{
    var token=jwtverify(req.headers.token);
    // console.log(temptopicname);
    if(token=='err'){ res.send("Error in token/token expired");}
    else if(token==undefined){res.send("Token not included");}
    else{//console.log(token.name);
    async function run(){
    var client=await MongoClient.connect(process.env.DBURI);
    var db=client.db(process.env.DB_USERNAME);
    var collection_user=db.collection('userinfo');
    var collection_files=db.collection('files');
    var collection_version=db.collection('versions');
    var users=await collection_user.find({'username':token.name}).toArray();
    if(users.length<1){
        client.close();
        res.send("Not Authorized/Please login");
        return;
    }else{
        var tempTopicName=req.params.topicname; 
        var tempRevNum=req.params.revNum;//console.log("revNum "+tempRevNum);
        var tempFileName=req.params.filename;//console.log("File Name "+tempFileName);
        var tempcolfile=await collection_files.find({"title":tempTopicName}).toArray();                
        var tempColUpdate=await collection_version.find({ $and: [{"filename":tempFileName},{"createdby":users[0]._id}] }).toArray(); 
       if(tempColUpdate==null){res.sendStatus(404);}
        else{
            if(tempColUpdate[0].revNum==tempRevNum){
                collection_version.updateOne({"_id":tempColUpdate[0]._id},{$set:{"desc":req.body.desc}});
            res.sendStatus(200);
            return;}
            else{
                res.sendStatus(404);
                return;
            }
        }
        client.close();
        return;
    }}run();}
});
app.get('/list',(req,res)=>{
    var token=jwtverify(req.headers.token);
    if(token=='err'){ res.send("Error in token/token expired");}
    else if(token==undefined){res.send("Token not included");}
    else{
    async function run(){
    var client=await MongoClient.connect(process.env.DBURI);
    var db=client.db(process.env.DB_USERNAME);
    var collection_user=db.collection('userinfo');
    var collection_files=db.collection('files');
    var collection_version=db.collection('versions');
    var users=await collection_user.find({'username':token.name}).toArray();
    if(users.length<1){
        client.close();
        res.send("Not Authorized/Please login");
        return;
    }else{
        var tempcolfile=await collection_files.find().toArray();                 
        res.send(tempcolfile);
        client.close();
        return;
    }}run();} 
});
app.get('/list/:topic',(req,res)=>{
    var token=jwtverify(req.headers.token);
    if(token=='err'){ res.send("Error in token/token expired");}
    else if(token==undefined){res.send("Token not included");}
    else{
    async function run(){
    var client=await MongoClient.connect(process.env.DBURI);
    var db=client.db(process.env.DB_USERNAME);
    var collection_user=db.collection('userinfo');
    var collection_files=db.collection('files');
    var collection_version=db.collection('versions');
    var users=await collection_user.find({'username':token.name}).toArray();
    if(users.length<1){
        client.close();
        res.send("Not Authorized/Please login");
        return;
    }else{
        var tempTopicName=req.params.topic;
        var tempcolfile=await collection_files.find({"title":tempTopicName}).toArray();
        var tempcolver=await collection_version.find({"file_id":tempcolfile[0]._id}).toArray();                 
        res.send(tempcolver);
        client.close();
        return;
    }}run();} 
});
app.get('/list/:topicname/:filename/:revNum',(req,res)=>{
    var temptopicname=req.params.topicname;
    var tempFileName=req.params.filename;
    var tempRevNum=req.params.revNum;
    var token=jwtverify(req.headers.token);
    if(token=='err'){ res.send("Error in token/token expired");}
    else if(token==undefined){res.send("Token not included");}
    else{
    async function run(){
    var client=await MongoClient.connect(process.env.DBURI);
    var db=client.db(process.env.DB_USERNAME);
    var collection_user=db.collection('userinfo');
    var collection_files=db.collection('files');
    var collection_version=db.collection('versions');
    var users=await collection_user.find({'username':token.name}).toArray();
    if(users.length<1){
        client.close();
        res.send("Not Authorized/Please login");
        return;
    }else{
        var tempcolfile=await collection_files.find({"title":temptopicname}).toArray();
        var tempcolver=await collection_version.find({ $and: [{"filename":tempFileName},{"createdby":users[0]._id}] }).toArray();
        if(tempcolver.length<1){
            res.send("File not created by user/File does not exist");
        }
        else{
            if(tempcolver[0].revNum==tempRevNum){
                //res.setHeader('Content-type',tempcolver[0].filetype);
                //res.setHeader('Content-disposition','attachment;filename='+tempcolver[0].filename);
                console.log(tempcolver[0].filetype);
                console.log(tempcolver[0].document);
                //res.writeHead(200, {
                //    'Content-Type': tempcolver[0].filetype,
                //    'Content-disposition': 'attachment;filename=' + tempcolver[0].filename
                                //});
                //res.end(tempcolver[0].document, 'binary');
                res.contentType(tempcolver[0].filetype);
                res.attachment(tempcolver[0].filename);
                res.send(Buffer.from(tempcolver[0].document.buffer));
                client.close();
                return;
            }
        }
        client.close();
        return;
    }}run();} 
});
app.listen(process.env.PORT,(req,res)=>{
console.log('Server started');
});

//console.log(process.env.DB_USERNAME);
//var out=checkusername('abhi','pass1').then(val=>console.log(val));
//console.log(out);
async function shutdown(signal, callback) {
    console.log(`${signal} received.`);
    if (typeof callback === 'function') callback();
    else process.exit(0);
  }
app.use((err, req, res, next) => {
    res.status(err.status || 400);
    res.json({
      name: err.name,
      message: err.message
    });
  });
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.once('SIGUSR2', signal => {
  shutdown(signal, () => process.kill(process.pid, 'SIGUSR2'));
});