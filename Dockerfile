FROM ubuntu:latest
RUN apt-get update
RUN apt-get install -y clang libsdl2-dev libsdl2-ttf-dev git libtool automake make curl valgrind
RUN apt-get install -y software-properties-common

RUN apt-add-repository ppa:cs50/ppa
RUN apt-get update
RUN apt-get install libcs50

ENV LD_LIBRARY_PATH=.:/usr/local/lib
ENV CC=clang
ENV LDLIBS="-lcrypt -lm -ltps -lSDL2 -lSDL2_ttf -lcs50"
ENV CFLAGS="-fsanitize=integer -fsanitize=undefined -ggdb3 -O0 -std=c11 -Wall -Werror -Wextra -Wno-sign-compare -Wshadow -DNO_WAIT"

RUN git clone https://gitlab.com/bramas/libtps.h.git
RUN cd libtps.h && make && make install NO_UI=1


RUN curl -o /usr/bin/run-in https://gist.githubusercontent.com/Bramas/29799b60d099661c904bbf2c5fc3c7d7/raw/5eb2f65b0164b839705ab8a5a4de3232c10a3b03/run.sh

VOLUME /var/src
WORKDIR /var/src
CMD ["sh", "run.sh"]
