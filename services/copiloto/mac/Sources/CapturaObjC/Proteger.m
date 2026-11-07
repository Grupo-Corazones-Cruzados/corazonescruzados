#import "Proteger.h"

@implementation Proteger
+ (BOOL)ejecutar:(NS_NOESCAPE void (^)(void))bloque error:(NSError **)error {
  @try {
    bloque();
    return YES;
  } @catch (NSException *e) {
    if (error) *error = [NSError errorWithDomain:@"Copiloto" code:3 userInfo:@{NSLocalizedDescriptionKey: e.reason ?: e.name}];
    return NO;
  }
}
@end
