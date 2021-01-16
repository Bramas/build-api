docker rm `docker ps --no-trunc -aq`
docker volume rm $(docker volume ls -f dangling=true -q)

