#include <stdio.h>

int main(void) {
FILE *fp;
fp=fopen("/home/test", "r");
if(fp)
{
	printf("exists\n");
return 0;
}
fp=fopen("/home/test", "w");
printf("%p\n",fp);
fprintf(fp, "Testing...\n");
return 0;
}
