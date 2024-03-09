import proxy from 'express-http-proxy';
import { handler } from './build/handler.js';
import express from 'express';

const app = express();


app.use('/events', proxy("http://localhost:8010", {
    proxyReqPathResolver: function (req) {
      return "/events" + req.url;
    }
  })
);
app.use('/api', proxy('http://localhost:8010', {
    proxyReqPathResolver: function (req) {
      return "/api" + req.url;
    }
  })
);
app.use('/user', proxy('http://localhost:8010', {
    proxyReqPathResolver: function (req) {
      return "/user" + req.url;
    }
  })
);
app.use('/conversation/', proxy('http://localhost:8010', {
    proxyReqPathResolver: function (req) {
      return "/conversation" + req.url;
    }
  })
);
app.use('/inbox', proxy('http://localhost:8010', {
    proxyReqPathResolver: function (req) {
      return "/inbox" + req.url;
    }
  })
);
app.use('/.well-known', proxy('http://localhost:8010', {
    proxyReqPathResolver: function (req) {
      return "/.well-known" + req.url;
    }
  })
);

app.use(handler);

app.listen(3000, () => {
  console.log('listening on port 3000');
});
